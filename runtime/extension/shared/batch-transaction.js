const HISTORY_LIMIT = 20;
const RESERVED_HISTORY_FIELDS = new Set(['from', 'to', 'at', 'reason']);

function safeHistoryData(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => !RESERVED_HISTORY_FIELDS.has(key)));
}

function normalizeHistory(values) {
  return (Array.isArray(values) ? values : []).slice(-HISTORY_LIMIT).map(item => ({
    ...safeHistoryData(item),
    from: String(item?.from || ''),
    to: String(item?.to || ''),
    at: Math.max(0, Number(item?.at) || 0),
    reason: String(item?.reason || '')
  }));
}

const TRANSITIONS = Object.freeze({
  draft: new Set(['frozen', 'released']),
  frozen: new Set(['submitting', 'draft', 'released']),
  submitting: new Set(['proven', 'terminal', 'draft', 'released']),
  proven: new Set(['answering', 'terminal', 'released']),
  answering: new Set(['terminal', 'released']),
  terminal: new Set(['released']),
  released: new Set()
});

export class BatchTransaction {
  #value;

  constructor({ batchId = '', memberIds = [], state = 'draft', createdAt = Date.now(), history = [] } = {}) {
    const normalized = TRANSITIONS[state] ? state : 'draft';
    this.#value = {
      batchId: String(batchId || ''),
      memberIds: [...new Set((Array.isArray(memberIds) ? memberIds : []).map(String).filter(Boolean))],
      state: normalized,
      createdAt: Number(createdAt) || Date.now(),
      updatedAt: Number(createdAt) || Date.now(),
      reason: '',
      history: normalizeHistory(history)
    };
  }

  transition(nextState, { reason = '', now = Date.now(), data = {} } = {}) {
    const next = String(nextState || '');
    if (next === this.#value.state) return { ok: true, duplicate: true, transaction: this.snapshot() };
    if (!TRANSITIONS[this.#value.state]?.has(next)) {
      return { ok: false, error: 'illegal_batch_transition', from: this.#value.state, to: next, transaction: this.snapshot() };
    }
    const from = this.#value.state;
    this.#value.state = next;
    this.#value.updatedAt = Number(now) || Date.now();
    this.#value.reason = String(reason || '');
    this.#value.history.push({ ...safeHistoryData(data), from, to: next, at: this.#value.updatedAt, reason: this.#value.reason });
    this.#value.history = this.#value.history.slice(-HISTORY_LIMIT);
    return { ok: true, duplicate: false, transaction: this.snapshot() };
  }

  snapshot() { return { ...this.#value, memberIds: [...this.#value.memberIds], history: this.#value.history.map(item => ({ ...item })) }; }
}