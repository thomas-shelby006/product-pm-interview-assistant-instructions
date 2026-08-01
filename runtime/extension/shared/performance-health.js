export function derivePerformanceHealth(snapshot = {}) {
  const budget = snapshot.performanceBudget || {};
  const storage = snapshot.storagePressure || {};
  const lanes = [snapshot.sender?.transportLane, snapshot.receiver?.transportLane].filter(Boolean);
  const commitWaitMs = Math.max(0, Number(budget.commitWaitMs || budget.maxCommitWaitMs || 0));
  const cacheHitRate = Number.isFinite(Number(budget.cacheHitRate)) ? Number(budget.cacheHitRate) : 1;
  const slowLane = lanes.find(lane => Number(lane?.rttMs || 0) > 1200 || lane?.circuit === 'open');
  const issues = [];
  if (storage.level === 'critical') issues.push({ code: 'storage_critical', severity: 'error' });
  else if (storage.level === 'high') issues.push({ code: 'storage_high', severity: 'warn' });
  if (commitWaitMs > 1000) issues.push({ code: 'commit_wait_high', severity: 'warn', value: commitWaitMs });
  if (cacheHitRate < .6) issues.push({ code: 'cache_hit_low', severity: 'warn', value: cacheHitRate });
  if (slowLane) issues.push({ code: 'transport_lane_slow', severity: 'warn', role: slowLane.role || '' });
  const userImpact = issues.some(item => item.severity === 'error') || Boolean(snapshot.deliverySla?.state === 'breached');
  return {
    state: userImpact ? 'degraded' : issues.length ? 'watch' : 'healthy',
    userImpact,
    issues,
    commitWaitMs,
    cacheHitRate,
    storagePercent: Math.max(0, Number(storage.percent || 0)),
    recommendation: userImpact ? 'stabilize_runtime' : issues.length ? 'observe_and_compact' : 'none'
  };
}
