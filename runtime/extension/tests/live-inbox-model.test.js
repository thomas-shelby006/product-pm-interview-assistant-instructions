import test from 'node:test';
import assert from 'node:assert/strict';
import { catchUpLabel, deriveLatencyRail, deriveLiveInbox } from '../dashboard/live-inbox-model.js';

function snapshot(overrides = {}) {
  return {
    sender: { connected: true, phase: 'ready', composerReady: true },
    receiver: { connected: true, phase: 'ready', composerReady: true, generating: false },
    ledger: [],
    ledgerCounts: { total: 0, pending: 0, inFlight: 0, proven: 0 },
    batchState: { active: null, next: null, hold: false, autoSubmit: true },
    storagePressure: { level: 'normal', percent: 10, bytes: 100 },
    proofArchive: { count: 0 },
    timeline: [],
    ...overrides
  };
}

function entry(id, seq, state, persistedAt = 100) {
  return {
    id,
    state,
    persistedAt,
    envelope: { id, seq, text: `Question ${seq}` }
  };
}

test('live inbox reports caught up only when no unresolved finals remain', () => {
  const view = deriveLiveInbox(snapshot({
    ledger: [entry('q1', 1, 'proven')],
    proofArchive: { count: 4 }
  }), 1000);
  assert.equal(view.catchUpState, 'live');
  assert.equal(view.provenCount, 5);
  assert.equal(view.pendingCount, 0);
  assert.equal(catchUpLabel(view.catchUpState), 'Caught up');
});

test('live inbox reports accumulation behind a generating receiver', () => {
  const view = deriveLiveInbox(snapshot({
    receiver: { connected: true, phase: 'ready', composerReady: true, generationState: { state: 'streaming', generating: true } },
    answerState: { batchId: 'b1', state: 'streaming', startedAt: 500 },
    ledger: [entry('q1', 1, 'submitting'), entry('q2', 2, 'staged'), entry('q3', 3, 'staged')],
    batchState: {
      active: { batchId: 'b1', memberIds: ['q1'], questionCount: 1 },
      next: { memberIds: ['q2', 'q3'], questionCount: 2 },
      hold: false,
      autoSubmit: true
    }
  }), 1000);
  assert.equal(view.catchUpState, 'accumulating');
  assert.equal(view.nextCount, 2);
  assert.equal(view.inFlightCount, 3);
});

test('operator hold and draft conflict override normal catch-up labels', () => {
  const held = deriveLiveInbox(snapshot({
    ledger: [entry('q1', 1, 'persisted')],
    batchState: { active: null, next: { memberIds: ['q1'], questionCount: 1 }, hold: true, autoSubmit: true }
  }));
  assert.equal(held.catchUpState, 'held');

  const blocked = deriveLiveInbox(snapshot({
    ledger: [entry('q1', 1, 'staged')],
    batchState: {
      active: null,
      next: { memberIds: ['q1'], questionCount: 1 },
      hold: false,
      autoSubmit: true,
      draftConflict: { at: 10 }
    }
  }));
  assert.equal(blocked.catchUpState, 'blocked');
  assert.equal(blocked.blocked, true);
});

test('live inbox preserves exact oldest unresolved age and storage state', () => {
  const view = deriveLiveInbox(snapshot({
    ledger: [entry('q1', 1, 'persisted', 100), entry('q2', 2, 'failed', 500)],
    storagePressure: { level: 'high', percent: 86.2, bytes: 8620 }
  }), 1100);
  assert.equal(view.oldestAgeMs, 1000);
  assert.equal(view.storage.level, 'high');
  assert.equal(view.pendingCount, 2);
});

test('latency rail derives ordered milestones for the latest final', () => {
  const view = deriveLatencyRail(snapshot({
    latestFinal: { id: 'q1', createdAt: 100 },
    timeline: [
      { type: 'final_persisted', at: 120, data: { envelopeId: 'q1' } },
      { type: 'batch_staged', at: 140, data: { memberIds: ['q1'] } },
      { type: 'batch_submitting', at: 150, data: { memberIds: ['q1'] } },
      { type: 'batch_proven', at: 180, data: { memberIds: ['q1'] } },
      { type: 'batch_answer_complete', at: 400, data: { memberIds: ['q1'] } }
    ]
  }));
  assert.deepEqual(view.milestones.map(item => [item.label, item.elapsedMs, item.complete]), [
    ['Persisted', 20, true],
    ['Staged', 40, true],
    ['Submitting', 50, true],
    ['Rendered proof', 80, true],
    ['Answer complete', 300, true]
  ]);
});
