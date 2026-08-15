export const QUESTION_FLOW_STAGES = [
  'finalized',
  'persisted',
  'routed_primary',
  'receiver_accepted',
  'provider_submitted',
  'provider_rendered',
  'proof_verified'
];

const safeString = value => String(value ?? '').trim();
const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function makeFlowTrace(input = {}, at = Date.now()) {
  return {
    envelopeId: safeString(input.envelopeId),
    seq: Math.max(0, safeNumber(input.seq)),
    stage: safeString(input.stage),
    status: safeString(input.status || 'ok'),
    role: safeString(input.role),
    provider: safeString(input.provider),
    reason: safeString(input.reason),
    elapsedMs: Math.max(0, safeNumber(input.elapsedMs)),
    at: Math.max(0, safeNumber(at))
  };
}

export function deriveLatestQuestionPath(timeline = []) {
  const traces = (Array.isArray(timeline) ? timeline : [])
    .filter(event => event?.type === 'flow_trace' && event?.data?.envelopeId)
    .map(event => ({ ...makeFlowTrace(event.data, event.at || event.data.at || 0) }));
  const latest = traces.at(-1);
  if (!latest) return { envelopeId: '', stages: [], failure: null };
  const envelopeId = latest.envelopeId;
  const relevant = traces.filter(item => item.envelopeId === envelopeId);
  const byStage = new Map(relevant.map(item => [item.stage, item]));
  const extraStages = relevant
    .map(item => item.stage)
    .filter(stage => stage && !QUESTION_FLOW_STAGES.includes(stage));
  const stages = [...QUESTION_FLOW_STAGES, ...new Set(extraStages)].map(stage => (
    byStage.get(stage) || { envelopeId, stage, status: 'waiting', reason: '', at: 0 }
  ));
  const failure = relevant.find(item => item.status === 'failed') || null;
  return { envelopeId, stages, failure };
}
