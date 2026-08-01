import test from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryLedgerIndex } from '../shared/delivery-ledger-index.js';
import { auditLedgerIndex } from '../shared/ledger-index-audit.js';

function entry(id, state = 'persisted', batchId = '') {
  return { id, state, batchId, envelope: { id, sourceProvider: 'chatgpt', seq: Number(id.slice(1)) || 1 } };
}

test('ledger index tracks state counts and batch membership through transitions', () => {
  const value = entry('q1');
  const index = new DeliveryLedgerIndex([value]);
  const previous = { state: value.state, batchId: value.batchId };
  value.state = 'staged';
  value.batchId = 'b1';
  index.update(value, previous);
  assert.deepEqual(index.idsForState('persisted'), []);
  assert.deepEqual(index.idsForState('staged'), ['q1']);
  assert.deepEqual(index.idsForBatch('b1'), ['q1']);
  assert.deepEqual(index.counts(), { total: 1, persisted: 0, staged: 1, submitting: 0, failed: 0, proven: 0, archived: 0, pending: 0, inFlight: 1, unresolved: 1 });
});

test('ledger index audit detects stale membership and rebuilds deterministically', () => {
  const first = entry('q1');
  const second = entry('q2', 'proven', 'b1');
  const entries = [first, second];
  const index = new DeliveryLedgerIndex(entries);
  second.state = 'archived';
  const failed = auditLedgerIndex(index, entries);
  assert.equal(failed.ok, false);
  assert.ok(failed.findings.some(item => item.code === 'state_membership_mismatch'));
  const repaired = auditLedgerIndex(index, entries, { repair: true });
  assert.equal(repaired.ok, true);
  assert.equal(repaired.rebuilt, true);
  assert.deepEqual(index.idsForState('archived'), ['q2']);
});

test('ledger index removes batch and state membership during compaction', () => {
  const value = entry('q1', 'proven', 'b1');
  const index = new DeliveryLedgerIndex([value]);
  assert.equal(index.remove(value), true);
  assert.deepEqual(index.idsForBatch('b1'), []);
  assert.deepEqual(index.idsForState('proven'), []);
  assert.equal(index.counts().total, 0);
});
