import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';

function envelope(id, seq = 1) {
  return {
    id,
    sessionId: 'pmia_session',
    sourceProvider: 'chatgpt',
    kind: 'question',
    seq,
    text: `Question ${id}`,
    metadata: {},
    createdAt: 1000 + seq
  };
}

test('pilot state derives role and lossless inbox warnings', () => {
  const state = new RuntimePilotState();
  state.ensure('pmia_session', 1000);
  state.updateRole('pmia_session', 'sender', {
    provider: 'chatgpt', phase: 'ready', composerReady: true, heartbeatAt: 2000
  }, 2000);
  state.setMode('pmia_session', 'paused', 3000);
  state.persistFinal('pmia_session', envelope('q1'), 3000);
  const snapshot = state.snapshot('pmia_session', 4000);
  assert.equal(snapshot.mode, 'paused');
  assert.equal(snapshot.ledger.length, 1);
  assert.equal(snapshot.ledgerCounts.pending, 1);
  assert.ok(snapshot.warnings.some(item => item.code === 'receiver_missing'));
  assert.ok(snapshot.warnings.some(item => item.code === 'transport_paused'));
  assert.ok(snapshot.warnings.some(item => item.code === 'inbox_waiting'));
});

test('pilot command results replay idempotently', () => {
  const state = new RuntimePilotState();
  state.recordCommandResult('pmia_session', 'req-1', 'check_live', { ok: true }, 10, 20);
  const first = state.replayCommandResult('pmia_session', 'req-1', 30);
  const second = state.replayCommandResult('pmia_session', 'req-1', 40);
  assert.equal(first.result.ok, true);
  assert.equal(second.entry.replayCount, 2);
});

test('pilot state survives export and restore with exact ledger identity', () => {
  const state = new RuntimePilotState();
  state.persistFinal('pmia_session', envelope('q1'), 1000);
  const restored = new RuntimePilotState(state.exportState());
  const snapshot = restored.snapshot('pmia_session', 2000);
  assert.equal(snapshot.latestFinal.id, 'q1');
  assert.equal(snapshot.ledger[0].id, 'q1');
  assert.equal(snapshot.ledger[0].state, 'persisted');
});

test('pilot state warns when the oldest unresolved inbox item exceeds two minutes', () => {
  const state = new RuntimePilotState();
  state.persistFinal('pmia_session', envelope('q1'), 1000);
  const snapshot = state.snapshot('pmia_session', 122000);
  assert.ok(snapshot.warnings.some(item => item.code === 'inbox_oldest_stale'));
});

test('pilot marks every batch member proven without removing unrelated finals', () => {
  const state = new RuntimePilotState();
  state.persistFinal('pmia_session', envelope('q1', 1), 1000);
  state.persistFinal('pmia_session', envelope('q2', 2), 1001);
  state.persistFinal('pmia_session', envelope('q3', 3), 1002);
  state.markLedgerStaged('pmia_session', ['q1', 'q2'], 'batch-1', 1010);
  state.markLedgerSubmitting('pmia_session', 'batch-1', 1020);
  state.markLedgerProven('pmia_session', 'batch-1', { verified: true, memberIds: ['q1', 'q2'] }, 1030);
  const snapshot = state.snapshot('pmia_session', 1040);
  assert.deepEqual(snapshot.ledger.map(item => [item.id, item.state]), [
    ['q1', 'proven'], ['q2', 'proven'], ['q3', 'persisted']
  ]);
  assert.equal(snapshot.metrics.delivered, 2);
});

test('pilot warnings escalate an active voice transcript stall', () => {
  const state = new RuntimePilotState();
  state.updateRole('pmia_session', 'sender', {
    provider: 'chatgpt', phase: 'ready', composerReady: true, heartbeatAt: 1000,
    sourceSilenceState: 'voice_stalled', sourceSilenceMs: 16000
  }, 1000);
  state.updateRole('pmia_session', 'receiver', {
    provider: 'chatgpt', phase: 'ready', composerReady: true, heartbeatAt: 1000
  }, 1000);
  assert.ok(state.snapshot('pmia_session', 2000).warnings.some(
    item => item.code === 'sender_voice_transcript_stalled' && item.severity === 'error'
  ));
});

test('pilot state exposes and warns on unverified receiver proof', () => {
  const state = new RuntimePilotState();
  state.record('pmia_session', 'receiver_proof', {
    envelopeId: 'q1', ok: true, verified: false, proof: 'submit_action_only'
  }, 1000);
  const snapshot = state.snapshot('pmia_session', 1001);
  assert.equal(snapshot.latestProof.verified, false);
  assert.ok(snapshot.warnings.some(item => item.code === 'receiver_proof_unverified'));
});

test('pilot state exposes repair progress and degraded warnings', () => {
  const state = new RuntimePilotState();
  state.setMode('pmia_session', 'repairing', 1000);
  assert.ok(state.snapshot('pmia_session', 1001).warnings.some(item => item.code === 'repair_in_progress'));
  state.setMode('pmia_session', 'degraded', 1002);
  assert.ok(state.snapshot('pmia_session', 1003).warnings.some(item => item.code === 'runtime_degraded'));
});

test('pilot state warns when a connected role regresses below READY', () => {
  const state = new RuntimePilotState();
  state.updateRole('pmia_session', 'sender', {
    provider: 'chatgpt', phase: 'boot', composerReady: true, heartbeatAt: 1000
  }, 1000);
  const snapshot = state.snapshot('pmia_session', 1100);
  assert.ok(snapshot.warnings.some(item => (
    item.code === 'sender_lifecycle_not_ready' && item.phase === 'boot'
  )));
});


test('safe heartbeat checkpoint preserves richer active batch proof metadata', () => {
  const state = new RuntimePilotState();
  state.updateBatchState('pmia_session', {
    type: 'batch_submitted',
    batchId: 'batch-1',
    memberIds: ['q1'],
    questionCount: 1,
    proof: { ok: true, verified: true, proof: 'new_rendered_turn' }
  }, 1000);
  state.restoreBatchState('pmia_session', {
    active: { batchId: 'batch-1', memberIds: ['q1'], questionCount: 1 },
    next: null,
    hold: false,
    autoSubmit: true
  }, 1100);
  assert.deepEqual(state.snapshot('pmia_session', 1200).batchState.active.proof, {
    ok: true,
    verified: true,
    proof: 'new_rendered_turn'
  });
});


test('reduced receiver checkpoint preserves pending no-response until an explicit clear', () => {
  const state = new RuntimePilotState();
  state.updateBatchState('pmia_session', {
    type: 'batch_answer_no_response',
    batchId: 'batch-1',
    memberIds: ['q1'],
    answerState: { state: 'no_response', reason: 'answer_never_started' }
  }, 1000);
  state.restoreBatchState('pmia_session', {
    active: null,
    next: { memberIds: ['q2'], questionCount: 1 },
    hold: false,
    autoSubmit: true
  }, 1100);
  assert.equal(state.snapshot('pmia_session', 1200).batchState.pendingNoResponse.batchId, 'batch-1');
  state.restoreBatchState('pmia_session', { pendingNoResponse: null }, 1300);
  assert.equal(state.snapshot('pmia_session', 1400).batchState.pendingNoResponse, null);
});

test('context armed is durable session state rather than timeline-only evidence', () => {
  const state = new RuntimePilotState();
  state.setContextArmed('s1', true, 100);
  const restored = new RuntimePilotState(state.exportState());
  assert.equal(restored.snapshot('s1', 101).contextArmed, true);
  assert.equal(restored.snapshot('s1', 101).contextArmedAt, 100);
});


test('Runtime Pilot stores and replays exact dashboard command results', () => {
  const state = new RuntimePilotState();
  state.recordCommandResult('session', 'request-1', 'check_live', { ok: true, reason: 'healthy' }, 10, 25);
  const replay = state.replayCommandResult('session', 'request-1');
  assert.equal(replay.replayed, true);
  assert.equal(replay.result.reason, 'healthy');
  const snapshot = state.snapshot('session', 30);
  assert.equal(snapshot.commandJournal[0].durationMs, 15);
  assert.equal(snapshot.commandJournal[0].replayCount, 1);
});

test('answer terminal metrics do not change rendered delivery success', () => {
  const state = new RuntimePilotState();
  state.persistFinal('pmia_session', envelope('q1'), 1000);
  state.markLedgerStaged('pmia_session', ['q1'], 'b1', 1100, { memberIds: ['q1'] });
  state.markLedgerSubmitting('pmia_session', 'b1', 1200);
  state.markLedgerProven('pmia_session', 'b1', { verified: true, memberIds: ['q1'] }, 1300);
  state.recordAnswer('pmia_session', { batchId: 'b1', state: 'no_response' }, 1400);
  const metrics = state.snapshot('pmia_session', 1500).metrics;
  assert.equal(metrics.deliverySuccessRate, 100);
  assert.equal(metrics.answersNoResponse, 1);
  assert.equal(metrics.answerAvailabilityRate, 0);
});

test('answer terminal state is counted once per batch', () => {
  const state = new RuntimePilotState();
  state.recordAnswer('pmia_session', { batchId: 'b1', state: 'timed_out' }, 1000);
  state.recordAnswer('pmia_session', { batchId: 'b1', state: 'timed_out' }, 1100);
  assert.equal(state.snapshot('pmia_session', 1200).metrics.answersTimedOut, 1);
});


test('stale receiver coordination cannot overwrite a newer operator pause', () => {
  const state = new RuntimePilotState([], { nowFn: () => 100 });
  state.ensure('pmia_session', 100);
  state.updateBatchState('pmia_session', {
    type: 'forwarding_paused',
    turnCoordination: { mode: 'paused_accumulating', pausedAt: 200, updatedAt: 200 }
  }, 200);
  state.updateBatchState('pmia_session', {
    type: 'turn_coordination_restored',
    turnCoordination: { mode: 'live', updatedAt: 150 }
  }, 300);
  const value = state.snapshot('pmia_session', 301).batchState.turnCoordination;
  assert.equal(value.mode, 'paused_accumulating');
  assert.equal(value.updatedAt, 200);
});

test('stale receiver checkpoint cannot roll coordination backward', () => {
  const state = new RuntimePilotState([], { nowFn: () => 100 });
  state.ensure('pmia_session', 100);
  state.updateBatchState('pmia_session', {
    type: 'forwarding_paused',
    turnCoordination: { mode: 'paused_accumulating', pausedAt: 200, updatedAt: 200 }
  }, 200);
  state.restoreBatchState('pmia_session', {
    turnCoordination: { mode: 'live', updatedAt: 150 }
  }, 300);
  assert.equal(state.snapshot('pmia_session', 301).batchState.turnCoordination.mode, 'paused_accumulating');
  state.restoreBatchState('pmia_session', {
    turnCoordination: { mode: 'live', resumedAt: 400, updatedAt: 400 }
  }, 400);
  assert.equal(state.snapshot('pmia_session', 401).batchState.turnCoordination.mode, 'live');
});
