import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReconciliationPayload,
  unresolvedLedgerEntries
} from '../shared/delivery-reconciler.js';

function entry(id, seq, state = 'persisted', batchId = '') {
  return {
    id,
    state,
    batchId,
    persistedAt: seq,
    envelope: {
      id,
      sessionId: 's1',
      sourceProvider: 'chatgpt',
      kind: 'question',
      seq,
      text: `Question ${seq}`,
      metadata: {},
      createdAt: seq
    }
  };
}

test('reconciliation includes every unresolved final in sequence order', () => {
  const snapshot = {
    ledger: [
      entry('q3', 3, 'failed'),
      entry('q1', 1, 'persisted'),
      entry('q2', 2, 'staged', 'batch-1'),
      entry('q4', 4, 'proven'),
      entry('q5', 5, 'archived')
    ]
  };
  assert.deepEqual(
    unresolvedLedgerEntries(snapshot).map(item => item.id),
    ['q1', 'q2', 'q3']
  );
  assert.deepEqual(
    buildReconciliationPayload(snapshot).pending.map(item => item.id),
    ['q1', 'q2', 'q3']
  );
});

test('reconciliation reconstructs frozen batch prompts without grouping next drafts', () => {
  const payload = buildReconciliationPayload({
    ledger: [
      entry('q1', 1, 'staged', 'batch-1'),
      entry('q2', 2, 'submitting', 'batch-1'),
      entry('q3', 3, 'staged', 'next'),
      entry('q4', 4, 'persisted', 'single-q4')
    ]
  });
  assert.equal(payload.batches.length, 1);
  assert.equal(payload.batches[0].id, 'batch-1');
  assert.deepEqual(payload.batches[0].memberIds, ['q1', 'q2']);
  assert.match(payload.batches[0].prompt.text, /LATEST QUESTION \(HIGHEST PRIORITY\)/);
  assert.deepEqual(payload.pending.map(item => item.id), ['q1', 'q2', 'q3', 'q4']);
});
