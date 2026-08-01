function cloneCredits(value = {}) {
  return {
    ...value,
    available: Math.max(0, Number(value.available) || 0),
    capacity: Math.max(1, Number(value.capacity) || 1),
    buffered: Math.max(0, Number(value.buffered) || 0),
    active: Math.max(0, Number(value.active) || 0),
    reason: String(value.reason || '')
  };
}

export class ReceiverCreditHysteresis {
  #recoveryWindowMs;
  #dropped = false;
  #stableSince = null;

  constructor({ recoveryWindowMs = 500 } = {}) {
    this.#recoveryWindowMs = Math.max(0, Number(recoveryWindowMs) || 0);
  }

  update(rawCredits, { now = Date.now(), critical = false, reason = '' } = {}) {
    const current = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const raw = cloneCredits(rawCredits);
    const blocked = Boolean(critical || raw.available <= 0);
    if (blocked) {
      this.#dropped = true;
      this.#stableSince = null;
      return {
        ...raw,
        available: 0,
        canAccept: false,
        state: 'backpressure',
        reason: String(reason || raw.reason || 'receiver_backpressure'),
        retryAfterMs: Math.max(1, Number(raw.retryAfterMs) || this.#recoveryWindowMs || 1),
        rawAvailable: raw.available,
        hysteresisState: critical ? 'critical' : 'blocked',
        stableSince: 0
      };
    }
    if (!this.#dropped || this.#recoveryWindowMs === 0) {
      this.#dropped = false;
      this.#stableSince = null;
      return {
        ...raw,
        canAccept: raw.available > 0,
        state: raw.available > 0 ? 'available' : 'backpressure',
        rawAvailable: raw.available,
        hysteresisState: 'stable',
        stableSince: 0
      };
    }
    if (this.#stableSince == null) this.#stableSince = current;
    const elapsed = Math.max(0, current - this.#stableSince);
    if (elapsed < this.#recoveryWindowMs) {
      return {
        ...raw,
        available: 0,
        canAccept: false,
        state: 'backpressure',
        reason: 'credit_recovery_stabilizing',
        retryAfterMs: Math.max(1, this.#recoveryWindowMs - elapsed),
        rawAvailable: raw.available,
        hysteresisState: 'recovering',
        stableSince: this.#stableSince
      };
    }
    this.#dropped = false;
    const stableSince = this.#stableSince;
    this.#stableSince = null;
    return {
      ...raw,
      canAccept: true,
      state: 'available',
      rawAvailable: raw.available,
      hysteresisState: 'stable',
      stableSince
    };
  }

  snapshot() {
    return {
      recoveryWindowMs: this.#recoveryWindowMs,
      dropped: this.#dropped,
      stableSince: this.#stableSince || 0
    };
  }
}
