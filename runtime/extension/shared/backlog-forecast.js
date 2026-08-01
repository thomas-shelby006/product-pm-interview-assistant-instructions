function percentile(values, p) { const list = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite).sort((a,b)=>a-b); if (!list.length) return 0; const index = Math.min(list.length - 1, Math.max(0, Math.ceil((p / 100) * list.length) - 1)); return Math.round(list[index]); }
export function deriveBacklogForecast({ queued = 0, oldestAgeMs = 0, targetMs = 20000, proofLatenciesMs = [], proofs = [] } = {}, now = Date.now()) {
  const count = Math.max(0, Number(queued) || 0); const times = (Array.isArray(proofs) ? proofs : []).map(item => Number(item?.at)).filter(Number.isFinite).sort((a,b)=>a-b);
  const windowMs = times.length > 1 ? Math.max(1000, times.at(-1) - times[0]) : 60000;
  const proofsPerMinute = times.length > 1 ? Math.round(((times.length - 1) * 60000 / windowMs) * 100) / 100 : 0;
  const perItemMs = proofsPerMinute > 0 ? 60000 / proofsPerMinute : percentile(proofLatenciesMs, 50) || 0;
  const drainEstimateMs = count && perItemMs ? Math.round(count * perItemMs) : count ? Infinity : 0;
  const projectedAgeMs = Math.max(0, Number(oldestAgeMs) || 0) + (Number.isFinite(drainEstimateMs) ? drainEstimateMs : Number(targetMs) * 2);
  const risk = count === 0 ? 'clear' : Number(oldestAgeMs) >= Number(targetMs) ? 'breached' : projectedAgeMs >= Number(targetMs) ? 'at_risk' : projectedAgeMs >= Number(targetMs) * .7 ? 'watch' : 'clear';
  return { queued: count, p50ProofMs: percentile(proofLatenciesMs, 50), p95ProofMs: percentile(proofLatenciesMs, 95), proofsPerMinute, drainEstimateMs, oldestAgeMs: Math.max(0, Number(oldestAgeMs) || 0), projectedAgeMs, targetMs: Math.max(1, Number(targetMs) || 20000), risk, evaluatedAt: Number(now) || Date.now() };
}