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
    sender: { connected: true, provider: 'chatgpt', ageMs: 100, stale: false },
    receiver: { connected: true, provider: 'claude', ageMs: 50, stale: false },
    hasPending: true
  });
  assert.deepEqual(describeRuntimeStatus(status), {
    text: 'FINAL QUEUED', tone: 'warn'
  });
});

test('session status keeps a present role connected regardless of heartbeat age', () => {
  const status = buildSessionStatus({
    sender: { provider: 'chatgpt', registeredAt: 100, tabId: 11 },
    receiver: null,
    pending: null
  }, 1000, 200);
  assert.equal(status.sender.connected, true);
  assert.equal(status.sender.stale, true);
  assert.deepEqual(describeRuntimeStatus(status), {
    text: 'WAITING RECEIVER', tone: 'warn'
  });
});

test('active preflight distinguishes unreachable runtime and unavailable composer', () => {
  const status = buildSessionStatus({
    sender: { provider: 'chatgpt', registeredAt: 990 },
    receiver: { provider: 'claude', registeredAt: 995 },
    pending: null
  }, 1000, 200);
  assert.deepEqual(describeRuntimeStatus(status, {
    responsive: false, reason: 'unreachable'
  }), {
    text: 'RUNTIME UNREACHABLE', tone: 'error'
  });
  assert.deepEqual(describeRuntimeStatus(status, {
    responsive: true, composerAvailable: false
  }), {
    text: 'COMPOSER NOT READY', tone: 'warn'
  });
  assert.deepEqual(describeRuntimeStatus(status, {
    responsive: true, composerAvailable: true
  }), {
    text: 'LINK OK', tone: 'ok'
  });
});