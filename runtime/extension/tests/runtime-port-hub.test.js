import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimePortHub, parseRolePortName, rolePortName } from '../shared/runtime-port-hub.js';

function event() {
  const listeners = [];
  return { addListener(fn) { listeners.push(fn); }, emit(value) { for (const fn of listeners) fn(value); } };
}

function fakePort(name, tabId = 1) {
  return {
    name,
    sender: { tab: { id: tabId, windowId: tabId + 100 } },
    onMessage: event(),
    onDisconnect: event(),
    sent: [],
    postMessage(message) { this.sent.push(message); }
  };
}

test('role port identity round trips exact session role and instance', () => {
  const name = rolePortName('session-1', 'sender', 'instance-1');
  assert.deepEqual(parseRolePortName(name), {
    sessionId: 'session-1', role: 'sender', instanceId: 'instance-1'
  });
  assert.equal(parseRolePortName('pmia-dashboard:session-1'), null);
});

test('runtime port hub routes sender frames and returns responses', async () => {
  const frames = [];
  const hub = createRuntimePortHub({
    async onFrame(frame) { frames.push(frame); return { ok: true, persisted: true }; }
  });
  const port = fakePort(rolePortName('s1', 'sender', 'i1'), 10);
  assert.equal(hub.connect(port), true);
  port.onMessage.emit({ type: 'request', requestId: 'r1', operation: 'final', payload: { id: 'q1' } });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(frames[0].identity.role, 'sender');
  assert.deepEqual(port.sent[0], {
    type: 'response', requestId: 'r1', result: { ok: true, persisted: true }
  });
});

test('runtime port hub request resolves receiver response and rejects on disconnect', async () => {
  const hub = createRuntimePortHub();
  const port = fakePort(rolePortName('s1', 'receiver', 'i2'), 20);
  hub.connect(port);
  const first = hub.request('s1', 'receiver', { operation: 'deliver', payload: { envelope: { id: 'q1' } } });
  const request = port.sent[0];
  port.onMessage.emit({ type: 'response', requestId: request.requestId, result: { ok: true } });
  assert.deepEqual(await first, { ok: true });

  const second = hub.request('s1', 'receiver', { operation: 'deliver', payload: {} });
  port.onDisconnect.emit();
  await assert.rejects(second, /port_disconnected/);
});

test('replacing a role port rejects requests owned by the old connection', async () => {
  const hub = createRuntimePortHub();
  const oldPort = fakePort(rolePortName('s1', 'receiver', 'old'), 20);
  hub.connect(oldPort);
  const pending = hub.request('s1', 'receiver', { operation: 'deliver', payload: {} });
  const nextPort = fakePort(rolePortName('s1', 'receiver', 'new'), 21);
  hub.connect(nextPort);
  await assert.rejects(pending, /port_replaced/);
  assert.equal(hub.get('s1', 'receiver').instanceId, 'new');
});
