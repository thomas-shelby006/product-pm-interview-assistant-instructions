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
    command: 'submit_selected'
  }), null);
  assert.equal(normalizeDashboardCommand({
    sessionId: 'pmia_123',
    requestId: 'req-2',
    command: 'submit_selected',
    payload: { queueItemId: 'env-1' }
  })?.payload.queueItemId, 'env-1');
});


test('live inbox controls are allow-listed and normalize policy values', () => {
  for (const command of ['submit_now', 'interrupt_latest', 'archive_all', 'archive_proven']) {
    assert.equal(normalizeDashboardCommand({
      sessionId: 'pmia_123', requestId: `req-${command}`, command
    })?.command, command);
  }
  assert.equal(normalizeDashboardCommand({
    sessionId: 'pmia_123', requestId: 'req-auto', command: 'set_auto_submit', payload: { value: 1 }
  })?.payload.value, true);
  assert.equal(normalizeDashboardCommand({
    sessionId: 'pmia_123', requestId: 'req-hold', command: 'set_hold', payload: { value: 0 }
  })?.payload.value, false);
});

test('archive selected requires an exact ledger item id', () => {
  assert.equal(normalizeDashboardCommand({
    sessionId: 'pmia_123', requestId: 'req-archive', command: 'archive_selected'
  }), null);
  assert.equal(normalizeDashboardCommand({
    sessionId: 'pmia_123', requestId: 'req-archive', command: 'archive_selected', payload: { queueItemId: 'q-1' }
  })?.payload.queueItemId, 'q-1');
});
