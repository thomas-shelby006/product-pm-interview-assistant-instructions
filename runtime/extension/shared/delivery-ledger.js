import { isEnvelope } from './protocol.js';

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
    proof: entry.proof && typeof entry.proof === 'object' ? { ...entry.proof } : null
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
    lastError: String(value?.lastError || ''),
    proof: value?.proof && typeof value.proof === 'object' ? { ...value.proof } : null,
    archivedAt: Number(value?.archivedAt || 0)
  };
}

function sameSequence(first, second) {
  const a = Number(first?.seq || 0);
  const b = Number(second?.seq || 0);
  return Boolean(a && b && a === b && first?.sourceProvider === second?.sourceProvider);
}

export class DeliveryLedger {
  #entries = [];

  constructor(state = []) {
    for (const value of Array.isArray(state) ? state : []) {
      const entry = normalizeEntry(value);
      if (!entry || this.#entries.some(existing => existing.id === entry.id)) continue;
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
    const duplicate = this.#entries.find(entry => (
      entry.id === String(envelope.id) || sameSequence(entry.envelope, envelope)
    ));
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
    const entry = this.#entries.find(candidate => candidate.id === String(id));
    return entry ? cloneEntry(entry) : null;
  }

  markPersisted(ids, reason = '', now = Date.now()) {
    return this.#transition(ids, entry => {
      if (!ACTIVE_LEDGER_STATES.has(entry.state)) return false;
      entry.state = 'persisted';
      entry.updatedAt = now;
      entry.lastError = String(reason || '');
      return true;
    });
  }

  markStaged(ids, batchId, now = Date.now()) {
    return this.#transition(ids, entry => {
      if (!ACTIVE_LEDGER_STATES.has(entry.state)) return false;
      entry.state = 'staged';
      entry.batchId = String(batchId || '');
      entry.updatedAt = now;
      entry.lastError = '';
      return true;
    });
  }

  markSubmitting(batchId, now = Date.now()) {
    return this.#transitionBatch(batchId, entry => {
      if (entry.state !== 'staged') return false;
      entry.state = 'submitting';
      entry.updatedAt = now;
      entry.attempts += 1;
      return true;
    });
  }

  markItemSubmitting(id, now = Date.now()) {
    return this.#transition([id], entry => {
      if (!['persisted', 'failed'].includes(entry.state)) return false;
      entry.state = 'submitting';
      entry.updatedAt = now;
      entry.attempts += 1;
      entry.lastError = '';
      return true;
    })[0] || null;
  }

  markProven(batchId, proof = {}, now = Date.now()) {
    return this.#transitionBatch(batchId, entry => this.#prove(entry, proof, now));
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
      return true;
    });
  }

  archive(ids, now = Date.now()) {
    return this.#transition(ids, entry => {
      if (entry.state === 'archived') return false;
      entry.state = 'archived';
      entry.updatedAt = now;
      entry.archivedAt = now;
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
    const removed = this.#entries.filter(entry => removeIds.has(entry.id)).map(cloneEntry);
    this.#entries = this.#entries.filter(entry => !removeIds.has(entry.id));
    return removed;
  }

  counts() {
    const counts = {
      total: this.#entries.length,
      persisted: 0,
      staged: 0,
      submitting: 0,
      failed: 0,
      proven: 0,
      archived: 0
    };
    for (const entry of this.#entries) counts[entry.state] += 1;
    counts.pending = counts.persisted + counts.failed;
    counts.inFlight = counts.staged + counts.submitting;
    counts.unresolved = counts.pending + counts.inFlight;
    return counts;
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
    return true;
  }

  #transition(ids, mutate) {
    const wanted = new Set((Array.isArray(ids) ? ids : [ids]).map(String));
    const changed = [];
    for (const entry of this.#entries) {
      if (!wanted.has(entry.id) || !mutate(entry)) continue;
      changed.push(cloneEntry(entry));
    }
    return changed;
  }

  #transitionBatch(batchId, mutate) {
    const changed = [];
    const normalized = String(batchId || '');
    for (const entry of this.#entries) {
      if (entry.batchId !== normalized || !mutate(entry)) continue;
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
