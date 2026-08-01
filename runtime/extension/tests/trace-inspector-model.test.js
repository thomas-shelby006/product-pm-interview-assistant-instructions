import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTraceIndex, searchDeliveryTraces, inspectDeliveryTrace } from '../dashboard/trace-inspector-model.js';

const snapshot = {
  ledger: [{ id: 'e1', state: 'submitting', batchId: 'b1', envelope: { id: 'e1', seq: 2, metadata: { traceId: 'tr-1' } }, persistedAt: 10, updatedAt: 20 }],
  timeline: [{ type: 'delivery_trace_span', at: 30, data: { traceId: 'tr-1', spanId: 'sp-1', stage: 'provider_submitted', state: 'complete', envelopeId: 'e1', batchId: 'b1', seq: 2 } }]
};

test('trace inspector searches by trace envelope sequence and batch', () => {
  const index = buildTraceIndex(snapshot);
  for (const query of ['tr-1', 'e1', '2', 'b1']) assert.equal(searchDeliveryTraces(index, query).length, 1);
});

test('trace inspector returns ordered spans and reason-coded next action', () => {
  const result = inspectDeliveryTrace(buildTraceIndex(snapshot)[0]);
  assert.equal(result.spans.at(-1).stage, 'provider_submitted');
  assert.equal(result.nextAction.code, 'await_rendered_proof');
});