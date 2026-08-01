import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDeliveryTrace, createTraceSpan, deriveBatchTrace } from '../shared/delivery-trace.js';

test('delivery trace is stable for one envelope and never depends on prompt text', () => {
  const envelope = { id: 'e1', sessionId: 's1', seq: 3, text: 'secret', metadata: {} };
  const first = ensureDeliveryTrace(envelope);
  const second = ensureDeliveryTrace(first);
  assert.equal(first.metadata.traceId, second.metadata.traceId);
  assert.doesNotMatch(first.metadata.traceId, /secret/);
});

test('trace spans and batch trace preserve safe correlation identities', () => {
  const span = createTraceSpan({ traceId: 'tr-1', stage: 'ledger_persisted', state: 'complete', at: 10, envelopeId: 'e1', seq: 1 });
  assert.equal(span.traceId, 'tr-1');
  assert.equal(span.stage, 'ledger_persisted');
  assert.equal('text' in span, false);
  const batch = deriveBatchTrace([{ id: 'e1', metadata: { traceId: 'tr-1' } }, { id: 'e2', metadata: { traceId: 'tr-2' } }], 'b1');
  assert.deepEqual(batch.memberTraceIds, ['tr-1', 'tr-2']);
});