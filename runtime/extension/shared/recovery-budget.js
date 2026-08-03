function normalizeAttempts(values) {
  return (Array.isArray(values) ? values : [])
    .map(item => ({ at: Math.max(0, Number(item?.at) || 0), source: String(item?.source || 'automatic') }))
    .filter(item => item.at > 0);
}

export class RecoveryBudget {
  #value;
  #maxAutomatic;
  #windowMs;
  #cooldownMs;
  #maxStoredAttempts;

  constructor(state = {}, { maxAutomatic = 4, windowMs = 300000, cooldownMs = 60000, maxStoredAttempts = 32 } = {}) {
    this.#maxAutomatic = Math.max(1, Number(maxAutomatic) || 4);
    this.#windowMs = Math.max(1000, Number(windowMs) || 300000);
    this.#cooldownMs = Math.max(1000, Number(cooldownMs) || 60000);
    this.#maxStoredAttempts = Math.max(this.#maxAutomatic, Number(maxStoredAttempts) || 32);
    this.#value = {
      attempts: normalizeAttempts(state?.attempts),
      exhaustedAt: Math.max(0, Number(state?.exhaustedAt) || 0),
      cooldownUntil: Math.max(0, Number(state?.cooldownUntil) || 0),
      lastResetAt: Math.max(0, Number(state?.lastResetAt) || 0),
      resetCount: Math.max(0, Number(state?.resetCount) || 0)
    };
  }

  #prune(now) {
    const threshold = Number(now) - this.#windowMs;
    const active = this.#value.attempts.filter(item => item.at >= threshold);
    if (active.length > this.#maxStoredAttempts) {
      const automatic = active.filter(item => item.source === 'automatic').slice(-this.#maxAutomatic);
      const remaining = Math.max(0, this.#maxStoredAttempts - automatic.length);
      const manual = active.filter(item => item.source !== 'automatic').slice(-remaining);
      this.#value.attempts = [...automatic, ...manual].sort((left, right) => left.at - right.at);
    } else {
      this.#value.attempts = active;
    }
    if (this.#value.cooldownUntil && Number(now) >= this.#value.cooldownUntil) {
      this.#value.exhaustedAt = 0;
      this.#value.cooldownUntil = 0;
    }
  }

  consume({ source = 'automatic', now = Date.now() } = {}) {
    const timestamp = Number(now) || Date.now();
    const normalizedSource = String(source || 'automatic');
    this.#prune(timestamp);
    if (normalizedSource === 'automatic') {
      const automatic = this.#value.attempts.filter(item => item.source === 'automatic').length;
      if (this.#value.cooldownUntil > timestamp || automatic >= this.#maxAutomatic) {
        this.#value.exhaustedAt ||= timestamp;
        this.#value.cooldownUntil = Math.max(this.#value.cooldownUntil, timestamp + this.#cooldownMs);
        return { accepted: false, state: 'exhausted', reason: 'automatic_recovery_budget_exhausted', budget: this.snapshot(timestamp) };
      }
    }
    this.#value.attempts.push({ at: timestamp, source: normalizedSource });
    return { accepted: true, state: normalizedSource === 'manual' ? 'manual' : 'available', reason: `${normalizedSource}_recovery_accepted`, budget: this.snapshot(timestamp) };
  }

  reset(now = Date.now()) {
    this.#value = { attempts: [], exhaustedAt: 0, cooldownUntil: 0, lastResetAt: Number(now) || Date.now(), resetCount: this.#value.resetCount + 1 };
    return this.snapshot(now);
  }

  snapshot(now = Date.now()) {
    const timestamp = Number(now) || Date.now();
    this.#prune(timestamp);
    const automaticUsed = this.#value.attempts.filter(item => item.source === 'automatic').length;
    const state = this.#value.cooldownUntil > timestamp || automaticUsed >= this.#maxAutomatic ? 'exhausted' : automaticUsed ? 'used' : 'available';
    return {
      state,
      maxAutomatic: this.#maxAutomatic,
      automaticUsed,
      remaining: Math.max(0, this.#maxAutomatic - automaticUsed),
      windowMs: this.#windowMs,
      cooldownMs: this.#cooldownMs,
      exhaustedAt: this.#value.exhaustedAt,
      cooldownUntil: this.#value.cooldownUntil,
      lastResetAt: this.#value.lastResetAt,
      resetCount: this.#value.resetCount,
      attempts: this.#value.attempts.map(item => ({ ...item }))
    };
  }
}