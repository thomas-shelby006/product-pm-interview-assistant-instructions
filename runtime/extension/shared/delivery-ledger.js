import { isEnvelope } from './protocol.js';

const ACTIVE_STATES = new Set(['persisted', 'staged', 'submitting', 'failed']);
const ALL_STATES = new Set([...ACTIVE_STATES, 'proven', 'archived']);

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
  const state = ALL_STATES.has(value?.state)
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
      if (!entry) continue;
      if (this.#entries.some(existing => existing.id === entry.id)) continue;
      this.#entries.push(entry);
    }
    this.#entries.sort((a, b) => (
      Number(a.envelope.seq || 0) - Number(b.envelope.seq || 0)
      || a.persistedAt - b.persistedAt
    ));
  }

  get size() {
    return this.retryable().length;
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
    this.#entries.sort((a, b) => (
      Number(a.envelope.seq || 0) - Number(b.envelope.seq || 0)
      || a.persistedAt - b.persistedAt
    ));
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

  markStaged(ids, batchId, now = Date.now()) {
    return this.#transition(ids, entry => {
      if (!ACTIVE_STATES.has(entry.state)) return false;
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

  markProven(batchId, proof = {}, now = Date.now()) {
    return this.#transitionBatch(batchId, entry => {
      if (!['staged', 'submitting', 'failed'].includes(entry.state)) return false;
      entry.state = 'proven';
      entry.updatedAt = now;
      entry.lastError = '';
      entry.proof = { ...proof, at: Number(proof.at || now) };
      return true;
    });
  }

  markFailed(ids, reason = 'delivery_failed', now = Date.now()) {
    return this.#transition(ids, entry => {
      if (!ACTIVE_STATES.has(entry.state)) return false;
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

  retryable() {
    return this.#entries.filter(entry => ACTIVE_STATES.has(entry.state)).map(cloneEntry);
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
    const counts = { total: this.#entries.length, persisted: 0, staged: 0, submitting: 0, failed: 0, proven: 0, archived: 0 };
    for (const entry of this.#entries) counts[entry.state] += 1;
    counts.pending = counts.persisted + counts.failed;
    counts.inFlight = counts.staged + counts.submitting;
    return counts;
  }

  // Compatibility facade for the PMIA 0.7 queue UI during migration.
  enqueue(envelope, options = {}) {
    const outcome = this.persist(envelope, options);
    return {
      accepted: outcome.accepted,
      reason: outcome.duplicate ? 'duplicate' : outcome.reason,
      item: outcome.entry ? this.#queueItem(outcome.entry) : null,
      dropped: []
    };
  }

  latest() {
    const entries = this.retryable();
    return entries.length ? this.#queueItem(entries.at(-1)) : null;
  }

  markSending(itemId, now = Date.now()) {
    const entry = this.#entries.find(candidate => candidate.id === String(itemId));
    if (!entry || !ACTIVE_STATES.has(entry.state)) return null;
    entry.state = 'submitting';
    entry.attempts += 1;
    entry.updatedAt = now;
    return this.#queueItem(entry);
  }

  complete(itemId, outcome = {}) {
    const entry = this.#entries.find(candidate => candidate.id === String(itemId));
    if (!entry) return null;
    const now = Number(outcome.now || Date.now());
    if (outcome.delivered) {
      entry.state = 'proven';
      entry.updatedAt = now;
      entry.proof = { reason: outcome.reason || 'accepted', at: now };
      return { delivered: true, queued: false, superseded: false, item: this.#queueItem(entry) };
    }
    entry.state = outcome.queued ? 'persisted' : 'failed';
    entry.updatedAt = now;
    entry.lastError = String(outcome.reason || 'receiver_unavailable');
    return { delivered: false, queued: Boolean(outcome.queued), superseded: false, item: this.#queueItem(entry) };
  }

  supersedeBefore() {
    return [];
  }

  discard(itemId) {
    const changed = this.archive([itemId]);
    return changed[0] ? this.#queueItem(changed[0]) : null;
  }

  discardSuperseded() {
    return [];
  }

  clear() {
    return this.archive(this.retryable().map(entry => entry.id)).map(entry => this.#queueItem(entry));
  }

  list() {
    return this.retryable().map(entry => this.#queueItem(entry));
  }

  exportState() {
    return this.snapshot();
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

  #queueItem(entry) {
    const value = entry?.envelope ? entry : normalizeEntry(entry);
    if (!value) return null;
    return {
      id: value.id,
      envelope: cloneEnvelope(value.envelope),
      queuedAt: value.persistedAt,
      updatedAt: value.updatedAt,
      reason: value.lastError || value.state,
      attempts: value.attempts,
      status: value.state === 'failed' ? 'failed' : value.state === 'archived' ? 'superseded' : value.state,
      lastError: value.lastError,
      batchId: value.batchId,
      ledgerState: value.state
    };
  }
}
