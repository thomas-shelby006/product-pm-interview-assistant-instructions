import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveReadiness } from '../dashboard/readiness-model.js';

function readySnapshot(now = 10000) {
  const role = { connected: true, phase: 'ready', composerReady: true, heartbeatAt: now, adapterCapabilities: { complete: true } };
  return { dashboardConnections: 1, mode: 'active', sender: { ...role }, receiver: { ...role }, contextArmed: true, storagePressure: { level: 'normal' }, senderOutboxState: { count: 0 }, selfTest: { ok: true, completedAt: now }, timeline: [] };
}

test('readiness is true only when every operational prerequisite is healthy', () => {
  const result = deriveReadiness(readySnapshot(), 10000);
  assert.equal(result.state, 'ready');
  assert.equal(result.label, 'Ready');
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.actions, []);
  assert.equal(result.evidenceSource, 'active_pulse');
  assert.equal(result.evidenceExpiresAt, 40000);
  assert.equal(result.rootCause.code, 'healthy');
});

test('readiness reports exact role context and storage blockers', () => {
  const snapshot = readySnapshot();
  snapshot.sender.phase = 'boot';
  snapshot.contextArmed = false;
  snapshot.storagePressure.level = 'critical';
  const result = deriveReadiness(snapshot, 10000);
  assert.equal(result.state, 'not_ready');
  assert.deepEqual(result.blockers.map(item => item.code), ['sender_not_ready', 'context_unarmed', 'storage_critical']);
});

test('repairing state is never presented as ready', () => {
  const snapshot = readySnapshot();
  snapshot.mode = 'repairing';
  assert.equal(deriveReadiness(snapshot, 10000).state, 'repairing');
});

test('sequence gaps and retained outbox finals block readiness', () => {
  const snapshot = readySnapshot();
  snapshot.timeline = [{ type: 'sequence_gap', data: { expectedSeq: 4 } }];
  snapshot.senderOutboxState = { count: 2 };
  assert.deepEqual(deriveReadiness(snapshot, 10000).blockers.map(item => item.code), ['sequence_gap', 'outbox_retained']);
});


test('missing adapter evidence blocks readiness rather than assuming health', () => {
  const snapshot = readySnapshot();
  delete snapshot.receiver.adapterCapabilities;
  assert.ok(deriveReadiness(snapshot, 10000).blockers.some(item => item.code === 'receiver_adapter'));
});


test('missing failed or stale active self-test blocks readiness', () => {
  const missing = readySnapshot();
  delete missing.selfTest;
  assert.ok(deriveReadiness(missing, 10000).blockers.some(item => item.code === 'self_test_missing'));
  const failed = readySnapshot();
  failed.selfTest = { ok: false, completedAt: 10000 };
  assert.ok(deriveReadiness(failed, 10000).blockers.some(item => item.code === 'self_test_failed'));
  const stale = readySnapshot();
  stale.selfTest = { ok: true, completedAt: 1 };
  assert.ok(deriveReadiness(stale, 40000).blockers.some(item => item.code === 'self_test_stale'));
});

test('readiness accepts evidence-fresh verification while preserving independent blockers', () => {
  const snapshot = readySnapshot(100000);
  snapshot.selfTest = { ok: true, completedAt: 40000 };
  snapshot.sender.transportLane = { lastMode: 'direct', lastRttMs: 5, updatedAt: 99000 };
  snapshot.receiver.transportLane = { lastMode: 'direct', lastRttMs: 6, updatedAt: 99000 };
  snapshot.sender.heartbeatAt = 99000;
  snapshot.receiver.heartbeatAt = 99000;
  const result = deriveReadiness(snapshot, 100000);
  assert.equal(result.state, 'ready');
  assert.equal(result.evidenceSource, 'role_and_transport_evidence');
});

test('failed active pulse remains a blocker despite fresh role evidence', () => {
  const snapshot = readySnapshot(100000);
  snapshot.selfTest = { ok: false, completedAt: 99000 };
  snapshot.sender.transportLane = { lastMode: 'direct', updatedAt: 99000 };
  snapshot.receiver.transportLane = { lastMode: 'direct', updatedAt: 99000 };
  assert.ok(deriveReadiness(snapshot, 100000).blockers.some(item => item.code === 'self_test_failed'));
});
