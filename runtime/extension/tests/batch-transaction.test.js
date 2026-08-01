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