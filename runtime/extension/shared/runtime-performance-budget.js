function cleanMap(value = {}) {
  return Object.fromEntries(
    Object.entries(value && typeof value === 'object' ? value : {})
      .map(([key, count]) => [String(key), Math.max(0, Number(count) || 0)])
  );
}

export class RuntimePerformanceBudget {
  #operations;
  #payloadBytes;
  #cacheHits;
  #cacheMisses;
  #commitReasons;
  #violations;
  #samples;

  constructor(state = {}) {
    this.#operations = cleanMap(state.operations);
    this.#payloadBytes = Math.max(0, Number(state.payloadBytes) || 0);
    this.#cacheHits = Math.max(0, Number(state.cacheHits) || 0);
    this.#cacheMisses = Math.max(0, Number(state.cacheMisses) || 0);
    this.#commitReasons = cleanMap(state.commitReasons);
    this.#violations = (Array.isArray(state.violations) ? state.violations : []).slice(-64).map(value => ({ ...value }));
    this.#samples = Math.max(0, Number(state.samples) || 0);
  }

  record(sample = {}) {
    const kind = String(sample.kind || 'unknown');
    const operations = Math.max(0, Number(sample.operations) || 0);
    const bytes = Math.max(0, Number(sample.bytes) || 0);
    const cacheHits = Math.max(0, Number(sample.cacheHits) || 0);
    const cacheMisses = Math.max(0, Number(sample.cacheMisses) || 0);
    const budget = Number.isFinite(Number(sample.budget)) ? Math.max(0, Number(sample.budget)) : Infinity;
    this.#operations[kind] = Math.max(0, Number(this.#operations[kind]) || 0) + operations;
    this.#payloadBytes += bytes;
    this.#cacheHits += cacheHits;
    this.#cacheMisses += cacheMisses;
    this.#samples += 1;
    const reason = String(sample.reason || '');
    if (reason) this.#commitReasons[reason] = Math.max(0, Number(this.#commitReasons[reason]) || 0) + 1;
    if (operations > budget) {
      this.#violations.push({
        kind,
        operations,
        budget,
        excess: operations - budget,
        entries: Math.max(0, Number(sample.entries) || 0),
        at: Math.max(0, Number(sample.at) || Date.now())
      });
      this.#violations = this.#violations.slice(-64);
    }
    return this.snapshot();
  }

  snapshot() {
    const cacheTotal = this.#cacheHits + this.#cacheMisses;
    return {
      state: this.#violations.length ? 'violated' : 'healthy',
      operations: { ...this.#operations },
      payloadBytes: this.#payloadBytes,
      cacheHits: this.#cacheHits,
      cacheMisses: this.#cacheMisses,
      cacheHitRate: cacheTotal ? Math.round((this.#cacheHits / cacheTotal) * 100) : 100,
      commitReasons: { ...this.#commitReasons },
      violations: this.#violations.map(value => ({ ...value })),
      samples: this.#samples
    };
  }

  exportState() {
    return this.snapshot();
  }
}
