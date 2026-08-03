import test from 'node:test';
import assert from 'node:assert/strict';
import { BatchTransaction } from '../shared/batch-transaction.js';

test('batch transaction accepts only legal ordered transitions', () => {
  const tx = new BatchTransaction({ batchId: 'b1', memberIds: ['q1'] });
  assert.equal(tx.transition('frozen').ok, true);
  assert.equal(tx.transition('submitting').ok, true);
  assert.equal(tx.transition('proven').ok, true);
  assert.equal(tx.transition('answering').ok, true);
  assert.equal(tx.transition('terminal').ok, true);
  assert.equal(tx.transition('released').ok, true);
  assert.equal(tx.transition('submitting').error, 'illegal_batch_transition');
});

test('batch transaction terminal transitions are idempotent', () => {
  const tx = new BatchTransaction({ batchId: 'b1', state: 'terminal', memberIds: ['q1'] });
  const duplicate = tx.transition('terminal');
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
});

test('batch transaction bounds and sanitizes restored history', () => {
  const history = Array.from({ length: 40 }, (_, index) => ({
    from: index ? 'frozen' : 'draft', to: 'frozen', at: index, reason: index, extra: index
  }));
  const snapshot = new BatchTransaction({ batchId: 'b1', history }).snapshot();
  assert.equal(snapshot.history.length, 20);
  assert.equal(snapshot.history[0].extra, 20);
  assert.equal(snapshot.history[19].extra, 39);
  assert.equal(snapshot.history[0].reason, '20');
});

test('batch transition data cannot override canonical transition identity', () => {
  const tx = new BatchTransaction({ batchId: 'b1' });
  const result = tx.transition('frozen', {
    reason: 'operator_pause', now: 123,
    data: { from: 'released', to: 'terminal', at: 999, reason: 'forged', detail: 'safe' }
  });
  assert.deepEqual(result.transaction.history[0], {
    detail: 'safe', from: 'draft', to: 'frozen', at: 123, reason: 'operator_pause'
  });
});
