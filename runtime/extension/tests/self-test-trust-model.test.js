import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSelfTestTrust } from '../dashboard/self-test-trust-model.js';

function snapshot(now = 100000) {
  const role = { connected: true, phase: 'ready', composerReady: true, heartbeatAt: now - 1000, transportLane: { lastMode: 'direct', lastRttMs: 5, updatedAt: now - 1000 } };
  return { selfTest: { ok: true, completedAt: now - 10000 }, sender: { ...role }, receiver: { ...role }, dashboardConnections: 1 };
}

test('fresh active pulse is actively verified', () => {
  assert.equal(deriveSelfTestTrust(snapshot(), 100000).state, 'active');
});

test('fresh role and direct-port evidence extends trust without rewriting pulse', () => {
  const value = snapshot();
  value.selfTest.completedAt = 40000;
  const result = deriveSelfTestTrust(value, 100000);
  assert.equal(result.state, 'evidence_fresh');
  assert.equal(result.source, 'role_and_transport_evidence');
  assert.equal(value.selfTest.completedAt, 40000);
});

test('failed pulse cannot be overridden by passive evidence', () => {
  const value = snapshot();
  value.selfTest.ok = false;
  assert.equal(deriveSelfTestTrust(value, 100000).state, 'failed');
});

test('missing or stale evidence is not trusted', () => {
  assert.equal(deriveSelfTestTrust({}, 100000).state, 'missing');
  const value = snapshot();
  value.selfTest.completedAt = 1;
  value.sender.heartbeatAt = 1;
  value.receiver.heartbeatAt = 1;
  assert.equal(deriveSelfTestTrust(value, 100000).state, 'stale');
});