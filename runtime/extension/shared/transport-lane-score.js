export function deriveTransportLaneScore(value = {}) {
  const state = String(value.state || 'closed');
  const failures = Math.max(0, Number(value.consecutiveFailures) || 0);
  const rtt = Math.max(0, Number(value.lastRttMs) || 0);
  const fallbackRecent = String(value.lastMode || '') === 'fallback';
  let score = 100;
  if (state === 'open') score -= 80;
  else if (state === 'probing' || state === 'half_open') score -= 35;
  score -= Math.min(45, failures * 18);
  if (rtt > 0) score -= Math.min(35, Math.floor(rtt / 75));
  if (fallbackRecent) score -= 8;
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    state: score >= 70 ? 'healthy' : score >= 35 ? 'degraded' : 'unhealthy',
    reason: state === 'open'
      ? 'circuit_open'
      : failures
        ? 'recent_failures'
        : rtt > 600
          ? 'high_rtt'
          : 'direct_healthy'
  };
}

export function chooseTransportLane(value = {}, { minimumDirectScore = 35 } = {}) {
  const direct = deriveTransportLaneScore(value);
  return {
    mode: direct.score >= Math.max(0, Number(minimumDirectScore) || 35) ? 'direct' : 'fallback',
    direct
  };
}