function hash(value) { let h = 0x811c9dc5; for (const c of String(value || '')) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
export function deliveryTraceId({ sessionId = '', id = '', seq = 0 } = {}) { return `tr-${hash(`${sessionId}|${id}|${Number(seq) || 0}`)}`; }
export function ensureDeliveryTrace(envelope = {}) {
  const metadata = envelope?.metadata && typeof envelope.metadata === 'object' ? { ...envelope.metadata } : {};
  metadata.traceId = String(metadata.traceId || deliveryTraceId(envelope));
  return { ...envelope, metadata };
}
export function traceSpanId(traceId, stage, at = Date.now()) { return `sp-${hash(`${traceId}|${stage}|${Number(at) || 0}`)}`; }
export function createTraceSpan({ traceId, spanId = '', stage, state = 'observed', at = Date.now(), envelopeId = '', batchId = '', seq = 0, reason = '', durationMs = 0, role = '' } = {}) {
  const trace = String(traceId || ''); const timestamp = Number(at) || Date.now();
  return { traceId: trace, spanId: String(spanId || traceSpanId(trace, stage, timestamp)), stage: String(stage || ''), state: String(state || 'observed'), at: timestamp, envelopeId: String(envelopeId || ''), batchId: String(batchId || ''), seq: Math.max(0, Number(seq) || 0), reason: String(reason || ''), durationMs: Math.max(0, Number(durationMs) || 0), role: String(role || '') };
}
export function deriveBatchTrace(entries = [], batchId = '') {
  const memberTraceIds = (Array.isArray(entries) ? entries : []).map(item => String(item?.metadata?.traceId || item?.envelope?.metadata?.traceId || '')).filter(Boolean);
  return { batchId: String(batchId || ''), traceId: `bt-${hash(`${batchId}|${memberTraceIds.join('|')}`)}`, memberTraceIds: [...memberTraceIds] };
}