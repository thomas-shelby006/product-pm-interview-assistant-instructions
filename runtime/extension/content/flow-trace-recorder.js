export function createFlowTraceRecorder({ telemetry, logEvent, runtimeConfig }) {
  return (stage, data = {}) => {
    const trace = {
      stage,
      status: String(data.status || 'ok'),
      envelopeId: String(data.envelopeId || ''),
      seq: Math.max(0, Number(data.seq || 0)),
      role: runtimeConfig.role,
      provider: runtimeConfig.provider,
      reason: String(data.reason || ''),
      elapsedMs: Math.max(0, Number(data.elapsedMs || 0)),
      ...(data.batchId ? { batchId: String(data.batchId) } : {})
    };
    telemetry.event('flow_trace', trace);
    void logEvent('flow_trace', trace);
  };
}

export function traceBatchFlowEvent(traceFlow, event = {}) {
  const envelopeId = Array.isArray(event.memberIds) ? String(event.memberIds.at(-1) || '') : '';
  if (event.type === 'batch_submitting') traceFlow('provider_submitted', { envelopeId, status: 'waiting', reason: 'submitting', batchId: event.batchId });
  if (event.type === 'batch_submit_failed') traceFlow('provider_submitted', { envelopeId, status: 'failed', reason: event.reason || 'submit_failed', batchId: event.batchId });
  if (event.type !== 'batch_submitted') return;
  traceFlow('provider_submitted', { envelopeId, status: 'ok', reason: 'submitted', batchId: event.batchId });
  const proof = { envelopeId, status: event.verified ? 'ok' : 'waiting', reason: event.verified ? 'verified' : 'proof_pending', batchId: event.batchId };
  traceFlow('provider_rendered', { ...proof, reason: event.verified ? 'rendered_turn' : 'proof_pending' });
  traceFlow('proof_verified', proof);
}
