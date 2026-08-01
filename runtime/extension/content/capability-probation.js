export class CapabilityProbation {
  #criticalThreshold;
  #healthyThreshold;
  #criticalSamples = 0;
  #healthySamples = 0;
  #state = 'unknown';
  #writeSafe = true;
  #reason = 'unobserved';

  constructor({ criticalThreshold = 2, healthyThreshold = 3, state = null } = {}) {
    this.#criticalThreshold = Math.max(1, Number(criticalThreshold) || 2);
    this.#healthyThreshold = Math.max(1, Number(healthyThreshold) || 3);
    if (state) this.restore(state);
  }

  restore(value = {}) {
    this.#criticalSamples = Math.max(0, Number(value.criticalSamples) || 0);
    this.#healthySamples = Math.max(0, Number(value.healthySamples) || 0);
    this.#state = String(value.state || 'unknown');
    this.#writeSafe = value.writeSafe !== false;
    this.#reason = String(value.reason || 'restored');
    return this.snapshot();
  }

  observe(report = {}, now = Date.now()) {
    const missingRequired = Array.isArray(report.missingRequired) ? report.missingRequired.map(String) : [];
    const critical = report.complete === false || missingRequired.length > 0;
    if (critical) {
      this.#criticalSamples += 1;
      this.#healthySamples = 0;
      this.#writeSafe = this.#criticalSamples < this.#criticalThreshold;
      this.#state = this.#writeSafe ? 'probation' : 'blocked';
      this.#reason = missingRequired.length ? `missing:${missingRequired.join(',')}` : 'required_surface_incomplete';
    } else {
      this.#healthySamples += 1;
      this.#criticalSamples = 0;
      if (!this.#writeSafe && this.#healthySamples < this.#healthyThreshold) {
        this.#state = 'recovering';
        this.#reason = 'awaiting_stable_recovery';
      } else {
        this.#writeSafe = true;
        this.#state = 'healthy';
        this.#reason = 'stable_required_surfaces';
      }
    }
    return this.snapshot(now);
  }

  snapshot(observedAt = 0) {
    return {
      state: this.#state,
      criticalSamples: this.#criticalSamples,
      healthySamples: this.#healthySamples,
      writeSafe: this.#writeSafe,
      reason: this.#reason,
      observedAt: Number(observedAt) || 0,
      thresholds: { critical: this.#criticalThreshold, healthy: this.#healthyThreshold }
    };
  }
}
