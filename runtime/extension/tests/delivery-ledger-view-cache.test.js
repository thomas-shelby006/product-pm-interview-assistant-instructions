import test from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryLedgerIndex } from '../shared/delivery-ledger-index.js';

function entry(id, state, seq) {
  return { id, state, batchId: '', persistedAt: seq, envelope: { id, seq, sourceProvider: 'chatgpt' } };
}

test('ledger view cache returns ordered clone-safe state groups', () => {
  const index = new DeliveryLedgerIndex([
    entry('q3', 'staged', 3),
    entry('q1', 'persisted', 1),
    entry('q2', 'failed', 2),
    entry('q4', 'proven', 4)
  ]);
  const first = index.view('unresolved');
  assert.deepEqual(first, ['q1', 'q2', 'q3']);
  first.push('mutated');
  assert.deepEqual(index.view('unresolved'), ['q1', 'q2', 'q3']);
  assert.deepEqual(index.view('pending'), ['q1', 'q2']);
  assert.deepEqual(index.view('proven'), ['q4']);
});

test('ledger view cache records hits and invalidates affected groups only', () => {
  const value = entry('q1', 'persisted', 1);
  const index = new DeliveryLedgerIndex([value]);
  index.view('pending');
  index.view('pending');
  index.view('proven');
  const before = index.viewStats();
  assert.equal(before.hits, 1);
  assert.equal(before.misses, 2);
  const previous = { state: value.state, batchId: value.batchId };
  value.state = 'proven';
  index.update(value, previous);
  assert.deepEqual(index.view('pending'), []);
  assert.deepEqual(index.view('proven'), ['q1']);
  const after = index.viewStats();
  assert.ok(after.invalidations >= 2);
});

test('ledger view cache resets on rebuild and removal', () => {
  const value = entry('q1', 'proven', 1);
  const index = new DeliveryLedgerIndex([value]);
  index.view('proven');
  index.remove(value);
  assert.deepEqual(index.view('proven'), []);
  index.rebuild([entry('q2', 'archived', 2)]);
  assert.deepEqual(index.view('archived'), ['q2']);
  assert.equal(index.viewStats().cachedGroups, 1);
});
