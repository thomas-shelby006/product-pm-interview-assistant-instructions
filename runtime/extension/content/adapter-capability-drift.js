function booleans(report = {}) { return Object.fromEntries(Object.entries(report).filter(([key, value]) => key !== 'complete' && typeof value === 'boolean')); }

export function evaluateAdapterCapabilityDrift(previous = {}, current = {}, prior = null, now = Date.now(), { stableSamples = 3 } = {}) {
  const before = booleans(previous); const after = booleans(current);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const removed = keys.filter(key => before[key] === true && after[key] === false);
  const restored = keys.filter(key => before[key] === false && after[key] === true);
  const required = new Set(Array.isArray(current?.required) ? current.required : []);
  const criticalRemoved = removed.filter(key => required.has(key));
  const timestamp = Number(now) || Date.now();
  if (removed.length) return {
    state: criticalRemoved.length ? 'critical' : 'degraded',
    severity: criticalRemoved.length ? 'critical' : 'warning',
    removed, restored: [], criticalRemoved,
    firstSeenAt: Number(prior?.firstSeenAt || timestamp),
    lastSeenAt: timestamp,
    stableRecoveryCount: 0
  };
  if (prior && prior.state !== 'stable') {
    const count = Math.max(0, Number(prior.stableRecoveryCount) || 0) + 1;
    return {
      state: count >= Math.max(1, Number(stableSamples) || 3) ? 'stable' : 'recovering',
      severity: count >= Math.max(1, Number(stableSamples) || 3) ? 'none' : 'warning',
      removed: [], restored,
      criticalRemoved: [],
      firstSeenAt: Number(prior.firstSeenAt || timestamp),
      lastSeenAt: timestamp,
      stableRecoveryCount: count
    };
  }
  return { state: 'stable', severity: 'none', removed: [], restored, criticalRemoved: [], firstSeenAt: 0, lastSeenAt: timestamp, stableRecoveryCount: 0 };
}