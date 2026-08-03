export const TURN_COORDINATION_STAGES = Object.freeze([
  'observe_persist',
  'persist_stage',
  'resume_submit',
  'stop_resubmit'
]);

export const TURN_COORDINATION_BUDGETS_MS = Object.freeze({
  observe_persist: 350,
  persist_stage: 200,
  resume_submit: 200,
  stop_resubmit: 150
});

const STAGE_SET = new Set(TURN_COORDINATION_STAGES);
const DEFAULT_MAX_SAMPLES = 512;
const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;
const THROUGHPUT_WINDOW_MS = 60 * 1000;

function safeId(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function normalizeSample(value = {}) {
  const stage = safeId(value.stage, 40);
  const correlationId = safeId(value.correlationId, 160);
  const startedAt = finite(value.startedAt, -1);
  const completedAt = finite(value.completedAt, -1);
  if (!STAGE_SET.has(stage) || !correlationId || startedAt < 0 || completedAt < startedAt) {
    return null;
  }
  return {
    stage,
    correlationId,
    startedAt,
    completedAt,
    durationMs: Math.max(0, Math.round(completedAt - startedAt)),
    memberCount: Math.max(0, Math.round(finite(value.memberCount, 0))),
    sequence: Math.max(0, Math.round(finite(value.sequence, 0)))
  };
}

function normalizeSamples(values = [], maxSamples = DEFAULT_MAX_SAMPLES) {
  const output = [];
  const index = new Map();
  for (const value of Array.isArray(values) ? values : []) {
    const sample = normalizeSample(value);
    if (!sample) continue;
    const key = `${sample.stage}:${sample.correlationId}`;
    if (index.has(key)) output[index.get(key)] = sample;
    else {
      index.set(key, output.length);
      output.push(sample);
    }
  }
  return output
    .sort((a, b) => a.completedAt - b.completedAt || a.sequence - b.sequence)
    .slice(-Math.max(20, Number(maxSamples) || DEFAULT_MAX_SAMPLES));
}
function percentile(values, ratio) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(ordered.length * ratio) - 1);
  return ordered[Math.min(index, ordered.length - 1)];
}

function stageReport(stage, samples, staleCount, budgetMs) {
  const durations = samples.map(item => item.durationMs);
  const p50Ms = percentile(durations, 0.5);
  const p95Ms = percentile(durations, 0.95);
  const maxMs = durations.length ? Math.max(...durations) : 0;
  const state = durations.length
    ? p95Ms <= budgetMs ? 'healthy' : 'breached'
    : staleCount ? 'stale' : 'insufficient';
  return {
    stage,
    state,
    budgetMs,
    sampleCount: durations.length,
    staleCount,
    p50Ms,
    p95Ms,
    maxMs
  };
}

export function createTurnCoordinationPerformance(value = {}) {
  return {
    version: 1,
    samples: normalizeSamples(value.samples)
  };
}
export function recordTurnCoordinationSample(value = {}, input = {}, {
  maxSamples = DEFAULT_MAX_SAMPLES,
  replaceExisting = false
} = {}) {
  const current = createTurnCoordinationPerformance(value);
  const sample = normalizeSample(input);
  if (!sample) return current;
  const key = `${sample.stage}:${sample.correlationId}`;
  const exists = current.samples.some(item => `${item.stage}:${item.correlationId}` === key);
  if (exists && !replaceExisting) return current;
  return {
    version: 1,
    samples: normalizeSamples([...current.samples, sample], maxSamples)
  };
}

export function deriveTurnCoordinationPerformance(value = {}, now = Date.now(), {
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
  budgets = TURN_COORDINATION_BUDGETS_MS,
  throughputTarget = 20
} = {}) {
  const current = createTurnCoordinationPerformance(value);
  const currentNow = Math.max(0, finite(now, Date.now()));
  const fresh = current.samples.filter(item => currentNow - item.completedAt <= staleAfterMs);
  const stages = {};
  for (const stage of TURN_COORDINATION_STAGES) {
    const stageFresh = fresh.filter(item => item.stage === stage);
    const staleCount = current.samples.filter(item => (
      item.stage === stage && currentNow - item.completedAt > staleAfterMs
    )).length;
    stages[stage] = stageReport(stage, stageFresh, staleCount, Math.max(1, finite(budgets?.[stage], TURN_COORDINATION_BUDGETS_MS[stage])));
  }
  const aggregateDurations = fresh.map(item => item.durationMs);
  const dominant = TURN_COORDINATION_STAGES
    .map(stage => stages[stage])
    .filter(item => item.sampleCount)
    .sort((a, b) => b.p95Ms - a.p95Ms || b.maxMs - a.maxMs)[0] || null;
  const recentAdmissions = current.samples.filter(item => (
    item.stage === 'observe_persist' &&
    item.completedAt <= currentNow &&
    currentNow - item.completedAt <= THROUGHPUT_WINDOW_MS
  ));
  const uniqueAdmissions = [...new Map(
    recentAdmissions.map(item => [item.correlationId, item])
  ).values()].sort((a, b) => a.sequence - b.sequence || a.completedAt - b.completedAt);
  const sequences = uniqueAdmissions.map(item => item.sequence).filter(Boolean);
  const target = Math.max(1, Math.round(finite(throughputTarget, 20)));
  return {
    version: 1,
    state: Object.values(stages).some(item => item.state === 'breached')
      ? 'breached'
      : aggregateDurations.length ? 'healthy' : 'insufficient',
    stages,
    sampleCount: fresh.length,
    staleCount: current.samples.length - fresh.length,
    p50Ms: percentile(aggregateDurations, 0.5),
    p95Ms: percentile(aggregateDurations, 0.95),
    maxMs: aggregateDurations.length ? Math.max(...aggregateDurations) : 0,
    dominantStage: dominant?.stage || '',
    throughput: {
      windowMs: THROUGHPUT_WINDOW_MS,
      targetPerMinute: target,
      admittedLastMinute: uniqueAdmissions.length,
      turnsPerMinute: uniqueAdmissions.length,
      uniqueCount: uniqueAdmissions.length,
      targetMet: uniqueAdmissions.length >= target,
      sequences
    },
    contentFree: true
  };
}
