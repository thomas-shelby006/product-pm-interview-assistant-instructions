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

test('pilot state derives role and queue warnings', () => {
  const state = new RuntimePilotState();
  state.ensure('pmia_session', 1000);
  state.updateRole('pmia_session', 'sender', {
    provider: 'chatgpt',
    composerReady: true,
    heartbeatAt: 2000
  }, 2000);
  state.setMode('pmia_session', 'paused', 3000);
  state.queueFinal('pmia_session', envelope('q1'), { now: 3000 });
  const snapshot = state.snapshot('pmia_session', 4000);
  assert.equal(snapshot.mode, 'paused');
  assert.equal(snapshot.queue.length, 1);
  assert.ok(snapshot.warnings.some(item => item.code === 'receiver_missing'));
  assert.ok(snapshot.warnings.some(item => item.code === 'transport_paused'));
});

test('pilot commands are idempotent', () => {
  const state = new RuntimePilotState();
  assert.equal(state.markCommand('pmia_session', 'req-1'), true);
  assert.equal(state.markCommand('pmia_session', 'req-1'), false);
});

test('pilot state survives export and restore with queue identity', () => {
  const state = new RuntimePilotState();
  state.recordFinal('pmia_session', envelope('q1'), 1000);
  state.queueFinal('pmia_session', envelope('q1'), { now: 1000 });
  const restored = new RuntimePilotState(state.exportState());
  const snapshot = restored.snapshot('pmia_session', 2000);
  assert.equal(snapshot.latestFinal.id, 'q1');
  assert.equal(snapshot.queue[0].id, 'q1');
});


test('pilot state warns when the oldest actionable queue item exceeds two minutes', () => {
  const state = new RuntimePilotState();
  state.queueFinal('pmia_session', envelope('q1'), { now: 1000 });
  const snapshot = state.snapshot('pmia_session', 122000);
  assert.ok(snapshot.warnings.some(item => item.code === 'queue_oldest_stale'));
});


test('pilot warnings escalate an active voice transcript stall', () => {
  const state = new RuntimePilotState();
  state.updateRole('pmia_session', 'sender', {
    provider: 'chatgpt', composerReady: true, heartbeatAt: 1000,
    sourceSilenceState: 'voice_stalled', sourceSilenceMs: 16000
  }, 1000);
  state.updateRole('pmia_session', 'receiver', {
    provider: 'chatgpt', composerReady: true, heartbeatAt: 1000
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
