import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveReadiness } from '../dashboard/readiness-model.js';

function readySnapshot(now = 10000) {
  const role = { connected: true, phase: 'ready', composerReady: true, heartbeatAt: now, adapterCapabilities: { complete: true } };
  return { dashboardConnections: 1, mode: 'active', sender: { ...role }, receiver: { ...role }, contextArmed: true, storagePressure: { level: 'normal' }, timeline: [] };
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
  snapshot.timeline = [
    { type: 'sequence_gap', data: { expectedSeq: 4 } },
    { type: 'outbox_state', data: { count: 2 } }
  ];
  assert.deepEqual(deriveReadiness(snapshot, 10000).blockers.map(item => item.code), ['sequence_gap', 'outbox_retained']);
});


test('missing adapter evidence blocks readiness rather than assuming health', () => {
  const snapshot = readySnapshot();
  delete snapshot.receiver.adapterCapabilities;
  assert.ok(deriveReadiness(snapshot, 10000).blockers.some(item => item.code === 'receiver_adapter'));
});
