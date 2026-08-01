const MAX_SAMPLES = 120;

export function addSloSample(history = [], snapshot = {}, now = Date.now()) {
  const sample = {
    at: Math.max(0, Number(now)),
    unresolved: Math.max(0, Number(snapshot.deliveryForecast?.queued ?? snapshot.ledgerCounts?.persisted ?? 0)),
    oldestAgeMs: Math.max(0, Number(snapshot.deliveryForecast?.oldestAgeMs || snapshot.deliverySla?.oldestAgeMs || 0)),
    p50Ms: Math.max(0, Number(snapshot.deliveryForecast?.p50Ms || 0)),
    p95Ms: Math.max(0, Number(snapshot.deliveryForecast?.p95Ms || 0)),
    proofsPerMinute: Math.max(0, Number(snapshot.deliveryForecast?.proofsPerMinute || 0)),
    risk: String(snapshot.deliveryForecast?.state || snapshot.deliverySla?.state || 'clear')
  };
  const prior = history[history.length - 1];
  const semantic = value => [value.unresolved, value.oldestAgeMs, value.p50Ms, value.p95Ms, value.proofsPerMinute, value.risk].join('|');
  if (prior && semantic(prior) === semantic(sample)) return history.slice(-MAX_SAMPLES);
  return [...history, sample].slice(-MAX_SAMPLES);
}

function percentile(values, ratio) {
  const list = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!list.length) return 0;
  return list[Math.min(list.length - 1, Math.floor((list.length - 1) * ratio))];
}

export function deriveSloTrend(history = [], targetMs = 20_000) {
  const samples = history.slice(-30);
  if (!samples.length) return { state: 'unknown', slope: 0, breachStreak: 0, p50Ms: 0, p95Ms: 0, estimatedDrainMinutes: 0 };
  const first = samples[0];
  const last = samples[samples.length - 1];
  const elapsedMinutes = Math.max(1 / 60, (last.at - first.at) / 60_000);
  const slope = Math.round(((last.unresolved - first.unresolved) / elapsedMinutes) * 100) / 100;
  let breachStreak = 0;
  for (let index = samples.length - 1; index >= 0 && samples[index].oldestAgeMs >= targetMs; index -= 1) breachStreak += 1;
  const throughput = Math.max(0, last.proofsPerMinute);
  const estimatedDrainMinutes = throughput > 0 ? Math.round((last.unresolved / throughput) * 10) / 10 : 0;
  const state = breachStreak >= 3 ? 'breached' : last.oldestAgeMs >= targetMs * .75 || slope > 0 ? 'at_risk' : slope < 0 ? 'recovering' : 'clear';
  return { state, slope, breachStreak, p50Ms: percentile(samples.map(item => item.p50Ms), .5), p95Ms: percentile(samples.map(item => item.p95Ms), .95), estimatedDrainMinutes };
}
