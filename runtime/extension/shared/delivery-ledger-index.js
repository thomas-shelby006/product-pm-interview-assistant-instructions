const STATES = ['persisted', 'staged', 'submitting', 'failed', 'proven', 'archived'];
const VIEW_GROUPS = {
  pending: ['persisted', 'failed'],
  inFlight: ['staged', 'submitting'],
  unresolved: ['persisted', 'failed', 'staged', 'submitting'],
  proven: ['proven'],
  archived: ['archived'],
  failed: ['failed']
};

function sequenceKey(provider, seq) {
  const value = Number(seq || 0);
  return value > 0 && provider ? `${String(provider)}:${value}` : '';
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => (
    Number(a?.envelope?.seq || 0) - Number(b?.envelope?.seq || 0)
    || Number(a?.persistedAt || 0) - Number(b?.persistedAt || 0)
    || String(a?.id || '').localeCompare(String(b?.id || ''))
  ));
}

function addToMap(map, key, entry) {
  const normalized = String(key || '');
  if (!normalized) return;
  if (!map.has(normalized)) map.set(normalized, new Set());
  map.get(normalized).add(entry);
}

function removeFromMap(map, key, entry) {
  const normalized = String(key || '');
  if (!normalized) return;
  const set = map.get(normalized);
  set?.delete(entry);
  if (set && !set.size) map.delete(normalized);
}

export class DeliveryLedgerIndex {
  #byId = new Map();
  #bySequence = new Map();
  #byBatch = new Map();
  #byState = new Map();
  #viewCache = new Map();
  #viewHits = 0;
  #viewMisses = 0;
  #viewInvalidations = 0;
  #rebuilds = 0;

  constructor(entries = []) { this.rebuild(entries); }

  byId(id) { return this.#byId.get(String(id || '')) || null; }

  bySequence(provider, seq) {
    const key = sequenceKey(provider, seq);
    return key ? this.#bySequence.get(key) || null : null;
  }

  entriesForBatch(batchId) { return sortEntries(this.#byBatch.get(String(batchId || '')) || []); }
  entriesForState(state) { return sortEntries(this.#byState.get(String(state || '')) || []); }
  idsForBatch(batchId) { return this.entriesForBatch(batchId).map(entry => String(entry.id)); }
  idsForState(state) { return this.entriesForState(state).map(entry => String(entry.id)); }

  view(group = 'all') {
    const normalized = String(group || 'all');
    if (this.#viewCache.has(normalized)) {
      this.#viewHits += 1;
      return [...this.#viewCache.get(normalized)];
    }
    this.#viewMisses += 1;
    const states = VIEW_GROUPS[normalized];
    const entries = normalized === 'all'
      ? [...this.#byId.values()]
      : states
        ? states.flatMap(state => [...(this.#byState.get(state) || [])])
        : [...(this.#byState.get(normalized) || [])];
    const ids = sortEntries(new Set(entries)).map(entry => String(entry.id));
    this.#viewCache.set(normalized, ids);
    return [...ids];
  }

  viewStats() {
    return {
      hits: this.#viewHits,
      misses: this.#viewMisses,
      invalidations: this.#viewInvalidations,
      cachedGroups: this.#viewCache.size
    };
  }

  insert(entry) {
    const id = String(entry?.id || '');
    if (!id) return { accepted: false, reason: 'invalid_id', entry: null };
    const existingId = this.#byId.get(id);
    if (existingId) return { accepted: false, reason: 'duplicate_id', entry: existingId };
    const key = sequenceKey(entry?.envelope?.sourceProvider, entry?.envelope?.seq);
    const existingSequence = key ? this.#bySequence.get(key) : null;
    if (existingSequence) return { accepted: false, reason: 'duplicate_sequence', entry: existingSequence };
    this.#byId.set(id, entry);
    if (key) this.#bySequence.set(key, entry);
    addToMap(this.#byState, entry?.state, entry);
    addToMap(this.#byBatch, entry?.batchId, entry);
    this.#invalidateViews(entry?.state);
    return { accepted: true, reason: 'inserted', entry };
  }

  update(entry, previous = {}) {
    if (this.byId(entry?.id) !== entry) return false;
    if (String(previous.state || '') !== String(entry.state || '')) {
      removeFromMap(this.#byState, previous.state, entry);
      addToMap(this.#byState, entry.state, entry);
      this.#invalidateViews(previous.state, entry.state);
    }
    if (String(previous.batchId || '') !== String(entry.batchId || '')) {
      removeFromMap(this.#byBatch, previous.batchId, entry);
      addToMap(this.#byBatch, entry.batchId, entry);
    }
    return true;
  }

  remove(entry) {
    const current = this.byId(entry?.id);
    if (!current || current !== entry) return false;
    this.#byId.delete(String(entry.id));
    const key = sequenceKey(entry?.envelope?.sourceProvider, entry?.envelope?.seq);
    if (key && this.#bySequence.get(key) === entry) this.#bySequence.delete(key);
    removeFromMap(this.#byState, entry?.state, entry);
    removeFromMap(this.#byBatch, entry?.batchId, entry);
    this.#invalidateViews(entry?.state);
    return true;
  }

  rebuild(entries = []) {
    this.#byId.clear(); this.#bySequence.clear(); this.#byBatch.clear(); this.#byState.clear();
    this.#viewCache.clear();
    this.#rebuilds += 1;
    for (const entry of Array.isArray(entries) ? entries : []) this.insert(entry);
    return this.stats();
  }

  counts() {
    const counts = { total: this.#byId.size };
    for (const state of STATES) counts[state] = this.#byState.get(state)?.size || 0;
    counts.pending = counts.persisted + counts.failed;
    counts.inFlight = counts.staged + counts.submitting;
    counts.unresolved = counts.pending + counts.inFlight;
    return counts;
  }

  audit(entries = []) {
    const list = Array.isArray(entries) ? entries : [];
    const findings = [];
    if (this.#byId.size !== list.length || list.some(entry => this.byId(entry.id) !== entry)) findings.push({ code: 'identity_membership_mismatch' });
    for (const entry of list) {
      const key = sequenceKey(entry?.envelope?.sourceProvider, entry?.envelope?.seq);
      if (key && this.#bySequence.get(key) !== entry) findings.push({ code: 'sequence_membership_mismatch', id: entry.id });
      if (!this.#byState.get(String(entry.state || ''))?.has(entry)) findings.push({ code: 'state_membership_mismatch', id: entry.id });
      if (entry.batchId && !this.#byBatch.get(String(entry.batchId))?.has(entry)) findings.push({ code: 'batch_membership_mismatch', id: entry.id });
    }
    const expectedIds = new Set(list.map(entry => String(entry.id)));
    for (const set of this.#byState.values()) for (const entry of set) if (!expectedIds.has(String(entry.id))) findings.push({ code: 'stale_state_member', id: entry.id });
    for (const set of this.#byBatch.values()) for (const entry of set) if (!expectedIds.has(String(entry.id))) findings.push({ code: 'stale_batch_member', id: entry.id });
    return { ok: findings.length === 0, findings, stats: this.stats(), counts: this.counts() };
  }

  stats() { return { ids: this.#byId.size, sequences: this.#bySequence.size, rebuilds: this.#rebuilds }; }

  #invalidateViews(...states) {
    const affected = new Set(['all']);
    for (const state of states.map(String).filter(Boolean)) {
      affected.add(state);
      for (const [group, members] of Object.entries(VIEW_GROUPS)) if (members.includes(state)) affected.add(group);
    }
    for (const group of affected) {
      if (this.#viewCache.delete(group)) this.#viewInvalidations += 1;
    }
  }
}
