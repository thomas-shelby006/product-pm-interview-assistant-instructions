import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dashboardPortName,
  normalizeDashboardCommand,
  parseDashboardPortName
} from '../shared/dashboard-protocol.js';

test('dashboard port names round-trip a session id', () => {
  const name = dashboardPortName('pmia_123');
  assert.equal(name, 'pmia-dashboard:pmia_123');
  assert.equal(parseDashboardPortName(name), 'pmia_123');
  assert.equal(parseDashboardPortName('other'), '');
});

test('dashboard commands require an allow-listed command and request id', () => {
  assert.deepEqual(normalizeDashboardCommand({
    sessionId: 'pmia_123',
    requestId: 'req-1',
    command: 'pause'
  }), {
    sessionId: 'pmia_123',
    requestId: 'req-1',
    command: 'pause',
    payload: {}
  });
  assert.equal(normalizeDashboardCommand({
    sessionId: 'pmia_123',
    requestId: 'req-2',
    command: 'unknown'
  }), null);
});

test('selected queue commands require an item id', () => {
  assert.equal(normalizeDashboardCommand({
    sessionId: 'pmia_123',
    requestId: 'req-1',
    command: 'send_selected'
  }), null);
  assert.equal(normalizeDashboardCommand({
    sessionId: 'pmia_123',
    requestId: 'req-2',
    command: 'send_selected',
    payload: { queueItemId: 'env-1' }
  })?.payload.queueItemId, 'env-1');
});
