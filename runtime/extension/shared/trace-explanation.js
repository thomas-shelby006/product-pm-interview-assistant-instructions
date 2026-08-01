const STAGE_LABELS = Object.freeze({
  observed: 'Window 1 observed the final', persisted: 'The lossless ledger accepted it', staged: 'Window 2 protected it in a batch', submitted: 'The provider submission started', proof: 'Window 2 rendered the exact batch', answer_terminal: 'The answer reached a terminal state'
});

export function explainTrace(trace = {}) {
  const spans = Array.isArray(trace.spans) ? trace.spans : [];
  const ordered = spans.slice().sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
  const steps = ordered.map(span => ({
    stage: String(span.stage || 'unknown'),
    label: STAGE_LABELS[span.stage] || String(span.stage || 'Unknown stage').replaceAll('_', ' '),
    state: String(span.state || 'observed'),
    reason: String(span.reason || ''),
    at: Math.max(0, Number(span.at || 0)),
    durationMs: Math.max(0, Number(span.durationMs || 0))
  }));
  const failed = steps.findLast?.(item => ['failed','timed_out','blocked'].includes(item.state)) || [...steps].reverse().find(item => ['failed','timed_out','blocked'].includes(item.state));
  const last = steps.at(-1) || null;
  return {
    traceId: String(trace.traceId || ''), envelopeId: String(trace.envelopeId || ''), batchId: String(trace.batchId || ''),
    state: failed ? 'needs_attention' : last?.stage === 'answer_terminal' ? 'complete' : last?.stage === 'proof' ? 'delivered' : steps.length ? 'in_progress' : 'unknown',
    summary: failed ? `${failed.label}: ${failed.reason || failed.state}` : last ? last.label : 'No trace evidence',
    steps
  };
}
