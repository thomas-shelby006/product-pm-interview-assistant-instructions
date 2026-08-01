const STATES = new Set(['closed', 'open', 'probing']);

function normalize(value = {}) {
  return {
    state: STATES.has(value?.state) ? value.state : 'closed',
    consecutiveFailures: Math.max(0, Number(value?.consecutiveFailures || 0)),
    nextProbeAt: Math.max(0, Number(value?.nextProbeAt || 0)),
    lastFailureReason: String(value?.lastFailureReason || ''),
    lastFailureAt: Math.max(0, Number(value?.lastFailureAt || 0)),
    lastSuccessAt: Math.max(0, Number(value?.lastSuccessAt || 0)),
    lastRttMs: Math.max(0, Number(value?.lastRttMs || 0)),
    lastMode: String(value?.lastMode || 'direct'),
    updatedAt: Math.max(0, Number(value?.updatedAt || 0))
  };
}

export class TransportCircuit {
  #state;
  #failureThreshold;
  #cooldownMs;
  #now;

  constructor(state = {}, { failureThreshold = 2, cooldownMs = 3000, now = Date.now } = {}) {
    this.#state = normalize(state);
    this.#failureThreshold = Math.max(1, Number(failureThreshold) || 2);
    this.#cooldownMs = Math.max(250, Number(cooldownMs) || 3000);
    this.#now = typeof now === 'function' ? now : Date.now;
  }

  canAttemptDirect(now = this.#now()) {
    return this.#state.state !== 'open' || Number(now) >= this.#state.nextProbeAt;
  }

  beginProbe(now = this.#now(), { force = false } = {}) {
    if (this.#state.state !== 'open') return this.#state.state === 'probing';
    if (!force && Number(now) < this.#state.nextProbeAt) return false;
    this.#state.state = 'probing';
    this.#state.updatedAt = Number(now);
    return true;
  }

  recordSuccess(rttMs = 0, now = this.#now()) {
    this.#state = {
      ...this.#state,
      state: 'closed',
      consecutiveFailures: 0,
      nextProbeAt: 0,
      lastFailureReason: '',
      lastSuccessAt: Number(now),
      lastRttMs: Math.max(0, Number(rttMs) || 0),
      lastMode: 'direct',
      updatedAt: Number(now)
    };
    return this.snapshot();
  }

  recordFailure(reason = 'port_failure', now = this.#now()) {
    const failures = this.#state.consecutiveFailures + 1;
    const shouldOpen = this.#state.state === 'probing' || failures >= this.#failureThreshold;
    this.#state = {
      ...this.#state,
      state: shouldOpen ? 'open' : 'closed',
      consecutiveFailures: failures,
      nextProbeAt: shouldOpen ? Number(now) + this.#cooldownMs : 0,
      lastFailureReason: String(reason || 'port_failure'),
      lastFailureAt: Number(now),
      lastMode: 'fallback',
      updatedAt: Number(now)
    };
    return this.snapshot();
  }

  markFallback(reason = '', now = this.#now()) {
    this.#state.lastMode = 'fallback';
    if (reason) this.#state.lastFailureReason = String(reason);
    this.#state.updatedAt = Number(now);
    return this.snapshot();
  }

  snapshot() { return { ...this.#state }; }
}
