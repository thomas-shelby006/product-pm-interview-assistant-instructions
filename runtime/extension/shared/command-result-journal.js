function clone(value) {
  if (value === undefined) return null;
  try { return JSON.parse(JSON.stringify(value)); } catch { return { ok: false, error: 'result_not_serializable' }; }
}

function normalizeEntry(value) {
  const requestId = String(value?.requestId || '').trim();
  const command = String(value?.command || '').trim();
  if (!requestId || !command) return null;
  const startedAt = Math.max(0, Number(value?.startedAt || 0));
  const completedAt = Math.max(startedAt, Number(value?.completedAt || startedAt));
  return {
    requestId,
    command,
    result: clone(value?.result || { ok: false, error: 'empty_command_result' }),
    startedAt,
    completedAt,
    durationMs: Math.max(0, Number(value?.durationMs ?? completedAt - startedAt) || 0),
    replayCount: Math.max(0, Number(value?.replayCount || 0)),
    lastReplayedAt: Math.max(0, Number(value?.lastReplayedAt || 0))
  };
}

export class CommandResultJournal {
  #entries = [];
  #maxEntries;

  constructor(state = [], { maxEntries = 128 } = {}) {
    this.#maxEntries = Math.max(8, Number(maxEntries) || 128);
    for (const value of Array.isArray(state) ? state : []) {
      const entry = normalizeEntry(value);
      if (!entry || this.#entries.some(item => item.requestId === entry.requestId)) continue;
      this.#entries.push(entry);
    }
    this.#entries.sort((a, b) => a.completedAt - b.completedAt);
    this.#trim();
  }

  lookup(requestId) {
    const entry = this.#entries.find(item => item.requestId === String(requestId || '').trim());
    return entry ? clone(entry) : null;
  }

  replay(requestId, now = Date.now()) {
    const entry = this.#entries.find(item => item.requestId === String(requestId || '').trim());
    if (!entry) return null;
    entry.replayCount += 1;
    entry.lastReplayedAt = Number(now) || Date.now();
    return { replayed: true, result: clone(entry.result), entry: clone(entry) };
  }

  record(requestId, command, result, startedAt = Date.now(), completedAt = Date.now()) {
    const normalized = normalizeEntry({ requestId, command, result, startedAt, completedAt });
    if (!normalized) return null;
    const index = this.#entries.findIndex(item => item.requestId === normalized.requestId);
    if (index >= 0) this.#entries.splice(index, 1);
    this.#entries.push(normalized);
    this.#trim();
    return clone(normalized);
  }

  recent(limit = 5) {
    const count = Math.max(0, Number(limit) || 0);
    return this.#entries.slice(-count).reverse().map(clone);
  }

  compact(retain = 64) {
    const keep = Math.max(8, Number(retain) || 64);
    const removed = Math.max(0, this.#entries.length - keep);
    if (removed) this.#entries = this.#entries.slice(-keep);
    return removed;
  }

  exportState() { return this.#entries.map(clone); }
  get size() { return this.#entries.length; }

  #trim() {
    if (this.#entries.length > this.#maxEntries) this.#entries = this.#entries.slice(-this.#maxEntries);
  }
}
