import test from 'node:test';
import assert from 'node:assert/strict';
import { SequenceGate } from '../shared/sequence.js';

test('sequence gate accepts increasing values and rejects duplicate or stale delivery', () => {
  const gate = new SequenceGate();
  assert.deepEqual(gate.check(1), { accepted: true, reason: 'new', lastAcceptedSeq: 0 });
  gate.accept(1);
  assert.deepEqual(gate.check(1), { accepted: false, reason: 'duplicate', lastAcceptedSeq: 1 });
  assert.deepEqual(gate.check(0), { accepted: true, reason: 'unsequenced', lastAcceptedSeq: 1 });
  assert.deepEqual(gate.check(2), { accepted: true, reason: 'new', lastAcceptedSeq: 1 });
  gate.accept(2);
  assert.deepEqual(gate.check(1), { accepted: false, reason: 'stale', lastAcceptedSeq: 2 });
});

test('sequence gate restores its accepted value after receiver reload', () => {
  const gate = new SequenceGate(12);
  assert.equal(gate.lastAcceptedSeq, 12);
  assert.equal(gate.check(12).accepted, false);
  assert.equal(gate.check(13).accepted, true);
});