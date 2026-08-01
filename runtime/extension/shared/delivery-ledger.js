import { isEnvelope } from './protocol.js';
import { memberSetFingerprint, sameMemberSet } from './batch-planner.js';
import { acquireAttemptLease, normalizeAttemptLease, releaseAttemptLease } from './delivery-attempt-lease.js';
import { DeliveryLedgerIndex } from './delivery-ledger-index.js';

export const ACTIVE_LEDGER_STATES = new Set(['persisted', 'staged', 'submitting', 'failed']);
const ALL_LEDGER_STATES = new Set([...ACTIVE_LEDGER_STATES, 'proven', 'archived']);

function cloneEnvelope(envelope) {
  return {
    ...envelope,
    metadata: envelope?.metadata && typeof envelope.metadata === 'object'
      ? { ...envelope.metadata }
      : {}
  };
}

function cloneEntry(entry) {
  return {
    ...entry,
    envelope: cloneEnvelope(entry.envelope),
    proof: entry.proof && typeof entry.proof === 'object' ? { ...entry.proof } : null,
    attemptLease: normalizeAttemptLease(entry.attemptLease)
  };
}

function normalizeEntry(value) {
  const envelope = value?.envelope || value;
  if (!isEnvelope(envelope) || envelope.kind === 'boot') return null;
  const persistedAt = Number(value?.persistedAt || value?.queuedAt || envelope.createdAt || Date.now());
  const state = ALL_LEDGER_STATES.has(value?.state)
    ? value.state
    : value?.status === 'superseded'
      ? 'archived'
      : value?.status === 'failed'
        ? 'failed'
        : 'persisted';
  return {
    id: String(value?.id || envelope.id),
    envelope: cloneEnvelope(envelope),
    state,
    persistedAt,
    updatedAt: Number(value?.updatedAt || persistedAt),
    attempts: Math.max(0, Number(value?.attempts) || 0),
    batchId: String(value?.batchId || ''),
    batchFingerprint: String(value?.batchFingerprint || ''),
    memberFingerprint: String(value?.memberFingerprint || ''),
    lastError: String(value?.lastError || ''),
    proof: value?.proof && typeof value.proof === 'object' ? { ...value.proof } : null,
    attemptLease: normalizeAttemptLease(value?.attemptLease),
    archivedAt: Number(value?.archivedAt || 0)
  };
}

export class DeliveryLedger {
  #entries = [];
  #index = new DeliveryLedgerIndex();

  constructor(state = []) {
    for (const value of Array.isArray(state) ? state : []) {
      const entry = normalizeEntry(value);
      if (!entry || !this.#index.insert(entry).accepted) continue;
      this.#entries.push(entry);
    }
    this.#sort();
  }

  get size() {
    return this.unresolved().length;
  }

  persist(envelope, { now = Date.now() } = {}) {
    if (!isEnvelope(envelope) || envelope.kind === 'boot') {
      return { accepted: false, persisted: false, reason: 'invalid_final', entry: null };
    }
    const duplicate = this.#index.byId(envelope.id)
      || this.#index.bySequence(envelope.sourceProvider, envelope.seq);
    if (duplicate) {
      return {
        accepted: true,
        persisted: true,
        duplicate: true,
        reason: 'duplicate',
        entry: cloneEntry(duplicate)
      };
    }
    const entry = normalizeEntry({ envelope, persistedAt: now, updatedAt: now, state: 'persisted' });
    const indexed = this.#index.insert(entry);
    if (!indexed.accepted) {
      return { accepted: true, persisted: true, duplicate: true, reason: indexed.reason, entry: cloneEntry(indexed.entry) };
    }
    this.#entries.push(entry);
    this.#sort();
    return {
      accepted: true,
      persisted: true,
      duplicate: false,
      reason: 'persisted',
      entry: cloneEntry(entry)
    };
  }

  get(id) {
    const entry = this.#index.byId(id);
    return entry ? cloneEntry(entry) : null;
  }

  markPersisted(ids, reason = '', now = Date.now()) {
    return this.#transition(ids, entry => {
      if (!ACTIVE_LEDGER_STATES.has(entry.state)) return false;
      entry.state = 'persisted';
      entry.updatedAt = now;
      entry.lastError = String(reason || '');
      entry.attemptLease = null;
      return true;
    });
  }

  markStaged(ids, batchId, now = Date.now(), identity = {}) {
    return this.#transition(ids, entry => {
      if (!ACTIVE_LEDGER_STATES.has(entry.state)) return false;
      entry.state = 'staged';
      entry.batchId = String(batchId || '');
      entry.batchFingerprint = String(identity?.fingerprint || entry.batchFingerprint || '');
      entry.memberFingerprint = String(identity?.memberFingerprint || entry.memberFingerprint || '');
      entry.updatedAt = now;
      entry.lastError = '';
      return true;
    });
  }

  markSubmitting(batchId, now = Date.now(), leaseOptions = {}) {
    const owner = String(leaseOptions?.owner || `batch:${batchId}`);
    return this.#transitionBatch(batchId, entry => {
      if (entry.state !== 'staged') return false;
      const lease = acquireAttemptLease(entry.attemptLease, {
        owner,
        reason: leaseOptions?.reason || 'batch_submit',
        now,
        ttlMs: leaseOptions?.ttlMs
      });
      if (!lease.accepted) return false;
      entry.attemptLease = lease.lease;
      entry.state = 'submitting';
      entry.updatedAt = now;
      entry.attempts += 1;
      return true;
    });
  }

  markItemSubmitting(id, now = Date.now(), leaseOptions = {}) {
    const owner = String(leaseOptions?.owner || `item:${id}`);
    return this.#transition([id], entry => {
      if (!['persisted', 'failed'].includes(entry.state)) return false;
      const lease = acquireAttemptLease(entry.attemptLease, {
        owner,
        reason: leaseOptions?.reason || 'item_submit',
        now,
        ttlMs: leaseOptions?.ttlMs
      });
      if (!lease.accepted) return false;
      entry.attemptLease = lease.lease;
      entry.state = 'submitting';
      entry.updatedAt = now;
      entry.attempts += 1;
      entry.lastError = '';
      return true;
    })[0] || null;
  }

  acquireAttemptLease(id, options = {}) {
    const entry = this.#index.byId(id);
    if (!entry || !ACTIVE_LEDGER_STATES.has(entry.state)) {
      return { accepted: false, reason: 'ledger_item_unavailable', lease: null, entry: entry ? cloneEntry(entry) : null };
    }
    const result = acquireAttemptLease(entry.attemptLease, options);
    if (result.accepted) {
      entry.attemptLease = result.lease;
      entry.updatedAt = Number(options?.now) || Date.now();
    }
    return { ...result, entry: cloneEntry(entry) };
  }

  releaseAttemptLease(id, options = {}) {
    const entry = this.#index.byId(id);
    if (!entry) return { released: false, reason: 'ledger_item_missing', lease: null, entry: null };
    const result = releaseAttemptLease(entry.attemptLease, options);
    if (result.released) {
      entry.attemptLease = null;
      entry.updatedAt = Number(options?.now) || Date.now();
    }
    return { ...result, entry: cloneEntry(entry) };
  }

  markBatchProven(batchId, proof = {}, now = Date.now()) {
    const normalized = String(batchId || '');
    const entries = this.#index.entriesForBatch(normalized).filter(entry => entry.state !== 'archived');
    if (!entries.length) return { accepted: false, duplicate: false, reason: 'batch_missing', changed: [], entries: [] };
    if (proof?.verified !== true) {
      return { accepted: false, duplicate: false, reason: 'proof_unverified', changed: [], entries: entries.map(cloneEntry) };
    }
    const expectedIds = entries.map(entry => entry.id);
    const proofIds = Array.isArray(proof?.memberIds) ? proof.memberIds.map(String) : [];
    if (!proofIds.length || !sameMemberSet(expectedIds, proofIds)) {
      return { accepted: false, duplicate: false, reason: 'proof_member_mismatch', changed: [], entries: entries.map(cloneEntry) };
    }
    const expectedMemberFingerprint = entries.find(entry => entry.memberFingerprint)?.memberFingerprint
      || memberSetFingerprint(expectedIds);
    if (proof?.memberFingerprint && proof.memberFingerprint !== expectedMemberFingerprint) {
      return { accepted: false, duplicate: false, reason: 'proof_member_fingerprint_mismatch', changed: [], entries: entries.map(cloneEntry) };
    }
    const expectedBatchFingerprint = entries.find(entry => entry.batchFingerprint)?.batchFingerprint || '';
    if (proof?.fingerprint && expectedBatchFingerprint && proof.fingerprint !== expectedBatchFingerprint) {
      return { accepted: false, duplicate: false, reason: 'proof_batch_fingerprint_mismatch', changed: [], entries: entries.map(cloneEntry) };
    }
    const alreadyProven = entries.every(entry => entry.state === 'proven');
    if (alreadyProven) {
      return { accepted: true, duplicate: true, reason: 'proof_duplicate', changed: [], entries: entries.map(cloneEntry) };
    }
    const normalizedProof = {
      ...proof,
      memberIds: [...proofIds],
      memberFingerprint: expectedMemberFingerprint,
      fingerprint: proof.fingerprint || expectedBatchFingerprint
    };
    const changed = this.#transitionBatch(normalized, entry => this.#prove(entry, normalizedProof, now));
    return { accepted: true, duplicate: false, reason: 'proof_accepted', changed, entries: entries.map(cloneEntry) };
  }

  markProven(batchId, proof = {}, now = Date.now()) {
    return this.markBatchProven(batchId, proof, now).changed;
  }

  markItemProven(id, proof = {}, now = Date.now()) {
    return this.#transition([id], entry => this.#prove(entry, proof, now))[0] || null;
  }

  markFailed(ids, reason = 'delivery_failed', now = Date.now()) {
    return this.#transition(ids, entry => {
      if (!ACTIVE_LEDGER_STATES.has(entry.state)) return false;
      entry.state = 'failed';
      entry.updatedAt = now;
      entry.lastError = String(reason || 'delivery_failed');
      entry.attemptLease = null;
      return true;
    });
  }

  archive(ids, now = Date.now()) {
    return this.#transition(ids, entry => {
      if (entry.state === 'archived') return false;
      entry.state = 'archived';
      entry.updatedAt = now;
      entry.archivedAt = now;
      entry.attemptLease = null;
      return true;
    });
  }

  archiveEntry(id, now = Date.now()) {
    return this.archive([id], now)[0] || null;
  }

  archiveAllUnresolved(now = Date.now()) {
    return this.archive(this.unresolved().map(entry => entry.id), now);
  }

  archiveProven(now = Date.now()) {
    return this.archive(this.proven().map(entry => entry.id), now);
  }

  unresolved() {
    return this.#entries.filter(entry => ACTIVE_LEDGER_STATES.has(entry.state)).map(cloneEntry);
  }

  pending() {
    return this.#entries
      .filter(entry => ['persisted', 'failed'].includes(entry.state))
      .map(cloneEntry);
  }

  proven() {
    return this.#entries.filter(entry => entry.state === 'proven').map(cloneEntry);
  }

  snapshot() {
    return this.#entries.map(cloneEntry);
  }

  compactProven(retain = 80) {
    const keep = Math.max(0, Number(retain) || 0);
    const proven = this.#entries.filter(entry => entry.state === 'proven');
    const removeCount = Math.max(0, proven.length - keep);
    if (!removeCount) return [];
    const removeIds = new Set(proven.slice(0, removeCount).map(entry => entry.id));
    const removedEntries = this.#entries.filter(entry => removeIds.has(entry.id));
    const removed = removedEntries.map(cloneEntry);
    for (const entry of removedEntries) this.#index.remove(entry);
    this.#entries = this.#entries.filter(entry => !removeIds.has(entry.id));
    return removed;
  }

  counts() {
    return this.#index.counts();
  }

  indexAudit({ repair = false } = {}) {
    const initial = this.#index.audit(this.#entries);
    if (initial.ok || !repair) return { ...initial, rebuilt: false };
    this.#index.rebuild(this.#entries);
    return { ...this.#index.audit(this.#entries), rebuilt: true, previousFindings: initial.findings };
  }

  exportState() {
    return this.snapshot();
  }

  #prove(entry, proof, now) {
    if (!ACTIVE_LEDGER_STATES.has(entry.state)) return false;
    entry.state = 'proven';
    entry.updatedAt = now;
    entry.lastError = '';
    entry.proof = { ...proof, at: Number(proof.at || now) };
    entry.attemptLease = null;
    return true;
  }

  #transition(ids, mutate) {
    const wanted = [...new Set((Array.isArray(ids) ? ids : [ids]).map(String))];
    const changed = [];
    for (const id of wanted) {
      const entry = this.#index.byId(id);
      if (!entry) continue;
      const previous = { state: entry.state, batchId: entry.batchId };
      if (!mutate(entry)) continue;
      this.#index.update(entry, previous);
      changed.push(cloneEntry(entry));
    }
    return changed;
  }

  #transitionBatch(batchId, mutate) {
    const changed = [];
    const normalized = String(batchId || '');
    for (const entry of this.#index.entriesForBatch(normalized)) {
      const previous = { state: entry.state, batchId: entry.batchId };
      if (!mutate(entry)) continue;
      this.#index.update(entry, previous);
      changed.push(cloneEntry(entry));
    }
    return changed;
  }

  #sort() {
    this.#entries.sort((a, b) => (
      Number(a.envelope.seq || 0) - Number(b.envelope.seq || 0)
      || a.persistedAt - b.persistedAt
    ));
  }
}
