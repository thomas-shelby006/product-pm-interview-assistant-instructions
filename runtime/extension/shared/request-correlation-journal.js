function cloneResult(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

export class RequestCorrelationJournal {
  #entries = new Map();
  #maxEntries;

  constructor({ maxEntries = 256 } = {}) {
    this.#maxEntries = Math.max(1, Number(maxEntries) || 256);
  }

  begin(requestId, { epoch = 0, operation = '', now = Date.now() } = {}) {
    const id = String(requestId || '');
    if (!id) return { accepted: false, reason: 'request_id_missing' };
    const existing = this.#entries.get(id);
    if (existing) {
      return { accepted: false, duplicate: true, reason: existing.state === 'pending' ? 'request_pending' : 'request_completed', entry: { ...existing } };
    }
    const entry = {
      requestId: id,
      epoch: Number(epoch) || 0,
      operation: String(operation || ''),
      state: 'pending',
      createdAt: Number(now) || Date.now(),
      completedAt: 0,
      duplicateResponses: 0,
      result: null,
      error: ''
    };
    this.#entries.set(id, entry);
    this.#trim();
    return { accepted: true, entry: { ...entry } };
  }

  acceptResponse(requestId, epoch) {
    const entry = this.#entries.get(String(requestId || ''));
    if (!entry) return { accepted: false, reason: 'request_unknown' };
    if (Number(entry.epoch) !== Number(epoch)) return { accepted: false, reason: 'stale_epoch' };
    if (entry.state !== 'pending') {
      entry.duplicateResponses += 1;
      return { accepted: false, duplicate: true, reason: 'duplicate_response' };
    }
    return { accepted: true, reason: 'response_accepted', entry: { ...entry } };
  }

  complete(requestId, result, now = Date.now()) {
    const entry = this.#entries.get(String(requestId || ''));
    if (!entry || entry.state !== 'pending') return false;
    entry.state = 'completed';
    entry.result = cloneResult(result);
    entry.completedAt = Number(now) || Date.now();
    this.#trim();
    return true;
  }

  fail(requestId, error, now = Date.now()) {
    const entry = this.#entries.get(String(requestId || ''));
    if (!entry || entry.state !== 'pending') return false;
    entry.state = 'failed';
    entry.error = String(error?.message || error || 'request_failed');
    entry.completedAt = Number(now) || Date.now();
    this.#trim();
    return true;
  }

  result(requestId) {
    const entry = this.#entries.get(String(requestId || ''));
    return entry?.state === 'completed' ? cloneResult(entry.result) : null;
  }

  remove(requestId) {
    return this.#entries.delete(String(requestId || ''));
  }

  snapshot() {
    return [...this.#entries.values()].map(entry => ({ ...entry, result: cloneResult(entry.result) }));
  }

  #trim() {
    if (this.#entries.size <= this.#maxEntries) return;
    const removable = [...this.#entries.values()]
      .filter(entry => entry.state !== 'pending')
      .sort((a, b) => a.completedAt - b.completedAt || a.createdAt - b.createdAt);
    while (this.#entries.size > this.#maxEntries && removable.length) {
      this.#entries.delete(removable.shift().requestId);
    }
  }
}