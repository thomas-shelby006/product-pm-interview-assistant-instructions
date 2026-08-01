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
      history: Array.isArray(history) ? history.map(item => ({ ...item })) : []
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
    this.#value.history.push({ from, to: next, at: this.#value.updatedAt, reason: this.#value.reason, ...data });
    this.#value.history = this.#value.history.slice(-20);
    return { ok: true, duplicate: false, transaction: this.snapshot() };
  }

  snapshot() { return { ...this.#value, memberIds: [...this.#value.memberIds], history: this.#value.history.map(item => ({ ...item })) }; }
}