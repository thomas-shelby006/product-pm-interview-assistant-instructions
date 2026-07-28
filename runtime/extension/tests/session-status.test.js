import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionStatus,
  describeRuntimeStatus
} from '../shared/session-status.js';

test('session status reports fresh sender, receiver, and pending final', () => {
  const status = buildSessionStatus({
    sender: { provider: 'chatgpt', registeredAt: 900 },
    receiver: { provider: 'claude', registeredAt: 950 },
    pending: { id: 'queued' }
  }, 1000, 200);
  assert.deepEqual(status, {
    sender: { connected: true, provider: 'chatgpt', ageMs: 100 },
    receiver: { connected: true, provider: 'claude', ageMs: 50 },
    hasPending: true
  });
  assert.deepEqual(describeRuntimeStatus(status), {
    text: 'FINAL QUEUED', tone: 'warn'
  });
});

test('session status distinguishes a missing or stale role', () => {
  const status = buildSessionStatus({
    sender: { provider: 'chatgpt', registeredAt: 100 },
    receiver: null,
    pending: null
  }, 1000, 200);
  assert.equal(status.sender.connected, false);
  assert.deepEqual(describeRuntimeStatus(status), {
    text: 'WAITING SENDER + RECEIVER', tone: 'error'
  });
});
