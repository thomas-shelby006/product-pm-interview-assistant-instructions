import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePaceGuard, paceLabel } from '../dashboard/pace-guard-model.js';

function finalEvent(id, at) {
  return { type: 'final_persisted', at, data: { envelopeId: id } };
}

function proofEvent(ids, at) {
  return { type: 'batch_proven', at, data: { memberIds: ids } };
}

function entry(id, state, persistedAt) {
  return { id, state, persistedAt, envelope: { id } };
}

test('pace guard reports falling behind when intake exceeds proof and backlog grows', () => {
  const now = 60_000;
  const pace = derivePaceGuard({
    receiver: { connected: true, phase: 'ready' },
    batchState: {},
    storagePressure: { level: 'normal' },
    ledger: [entry('q2', 'persisted', 20_000), entry('q3', 'staged', 30_000)],
    timeline: [finalEvent('q1', 10_000), finalEvent('q2', 20_000), finalEvent('q3', 30_000), proofEvent(['q1'], 40_000)]
  }, now);
  assert.equal(pace.state, 'falling_behind');
  assert.equal(pace.intakePerMinute, 3);
  assert.equal(pace.proofPerMinute, 1);
  assert.equal(pace.unresolved, 2);
  assert.equal(paceLabel(pace.state), 'Falling behind');
});

test('pace guard estimates recovery time when proof rate exceeds intake', () => {
  const now = 60_000;
  const pace = derivePaceGuard({
    receiver: { connected: true, phase: 'ready' },
    batchState: {},
    storagePressure: { level: 'normal' },
    ledger: [entry('q4', 'persisted', 50_000)],
    timeline: [
      finalEvent('q1', 10_000), finalEvent('q4', 50_000),
      proofEvent(['q1'], 20_000), proofEvent(['q2'], 30_000), proofEvent(['q3'], 40_000)
    ]
  }, now);
  assert.equal(pace.state, 'recovering');
  assert.equal(pace.estimatedCatchUpMs, 60_000);
});

test('pace guard reports caught up only with no unresolved ledger entries', () => {
  const pace = derivePaceGuard({
    receiver: { connected: true, phase: 'ready' },
    batchState: {},
    storagePressure: { level: 'normal' },
    ledger: [entry('q1', 'proven', 100)],
    timeline: [finalEvent('q1', 100), proofEvent(['q1'], 200)]
  }, 1_000);
  assert.equal(pace.state, 'caught_up');
  assert.equal(pace.unresolved, 0);
  assert.equal(pace.estimatedCatchUpMs, 0);
});

test('pace guard reports blocked for draft conflict or unhealthy receiver', () => {
  const pace = derivePaceGuard({
    receiver: { connected: true, phase: 'ready' },
    batchState: { draftConflict: { at: 100 } },
    storagePressure: { level: 'normal' },
    ledger: [entry('q1', 'persisted', 100)],
    timeline: [finalEvent('q1', 100)]
  }, 1_000);
  assert.equal(pace.state, 'blocked');
});
