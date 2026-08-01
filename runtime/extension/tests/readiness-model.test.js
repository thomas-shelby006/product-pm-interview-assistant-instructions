import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveReadiness } from '../dashboard/readiness-model.js';

function readySnapshot(now = 10000) {
  const role = { connected: true, phase: 'ready', composerReady: true, heartbeatAt: now, adapterCapabilities: { complete: true } };
  return { dashboardConnections: 1, mode: 'active', sender: { ...role }, receiver: { ...role }, contextArmed: true, storagePressure: { level: 'normal' }, senderOutboxState: { count: 0 }, selfTest: { ok: true, completedAt: now }, timeline: [] };
}

test('readiness is true only when every operational prerequisite is healthy', () => {
  assert.deepEqual(deriveReadiness(readySnapshot(), 10000), { state: 'ready', label: 'Ready', blockers: [], actions: [] });
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
