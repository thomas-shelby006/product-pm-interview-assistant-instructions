import { createTraceSpan } from '../shared/delivery-trace.js';
function nextAction(state, spans) { const latest = spans.at(-1); if (state === 'proven') return { code: 'complete', label: 'Rendered proof complete' }; if (state === 'archived') return { code: 'archived', label: 'Archived' }; if (latest?.stage === 'provider_submitted' || state === 'submitting') return { code: 'await_rendered_proof', label: 'Await provider-rendered proof' }; if (state === 'failed') return { code: 'retry_delivery', label: 'Retry retained final' }; return { code: 'await_delivery', label: 'Await receiver delivery' }; }
export function buildTraceIndex(snapshot = {}) {
  const timeline = Array.isArray(snapshot?.timeline) ? snapshot.timeline : [];
  return (Array.isArray(snapshot?.ledger) ? snapshot.ledger : []).map(entry => {
    const envelope = entry?.envelope || {}; const traceId = String(envelope?.metadata?.traceId || '');
    const spans = [createTraceSpan({ traceId, stage: 'ledger_persisted', state: entry.state === 'persisted' ? 'complete' : 'observed', at: entry.persistedAt || envelope.createdAt, envelopeId: entry.id || envelope.id, batchId: entry.batchId, seq: envelope.seq, role: 'background' })];
    for (const event of timeline) { const data = event?.data || {}; if (event?.type === 'delivery_trace_span' && String(data.traceId || '') === traceId) spans.push({ ...data, at: Number(data.at || event.at || 0) }); }
    spans.sort((a,b)=>Number(a.at)-Number(b.at));
    return { traceId, envelopeId: String(entry?.id || envelope?.id || ''), seq: Math.max(0, Number(envelope?.seq)||0), batchId: String(entry?.batchId || ''), state: String(entry?.state || ''), spans };
  }).filter(item => item.traceId);
}
export function searchDeliveryTraces(index = [], query = '') { const needle = String(query || '').trim().toLowerCase(); if (!needle) return index; return index.filter(item => [item.traceId,item.envelopeId,String(item.seq),item.batchId].some(value=>String(value||'').toLowerCase().includes(needle))); }
export function inspectDeliveryTrace(item) { if (!item) return null; const spans = [...(item.spans || [])].sort((a,b)=>Number(a.at)-Number(b.at)); return { ...item, spans, nextAction: nextAction(item.state, spans) }; }