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

async function completeHandshake(port) {
  const offer = port.sent.find(message => message.type === 'transport_handshake_offer');
  assert.ok(offer, 'hub must send a handshake offer');
  port.onMessage.emit({ type: 'transport_handshake_accept', handshake: offer.handshake });
  await Promise.resolve();
  await Promise.resolve();
  const result = port.sent.find(message => message.type === 'transport_handshake_result');
  assert.equal(result?.ok, true);
  const protocol = result.protocol;
  port.sent.length = 0;
  return protocol;
}

function scheduler() {
  let sequence = 0;
  const timers = new Map();
  return {
    timers,
    setTimer(fn) { const id = ++sequence; timers.set(id, fn); return id; },
    clearTimer(id) { timers.delete(id); },
    fireNext() { const entry = timers.entries().next().value; assert.ok(entry, 'timer must exist'); const [id, fn] = entry; timers.delete(id); fn(); }
  };
}

test('role port identity round trips exact session role and instance', () => {
  const name = rolePortName('session-1', 'sender', 'instance-1');
  assert.deepEqual(parseRolePortName(name), { sessionId: 'session-1', role: 'sender', instanceId: 'instance-1' });
  assert.equal(parseRolePortName('pmia-dashboard:session-1'), null);
});

test('runtime port hub routes sender frames and returns responses', async () => {
  const frames = [];
  const hub = createRuntimePortHub({ async onFrame(frame) { frames.push(frame); return { ok: true, persisted: true }; } });
  const port = fakePort(rolePortName('s1', 'sender', 'i1'), 10);
  assert.equal(hub.connect(port), true);
  const protocol = await completeHandshake(port);
  port.onMessage.emit({ type: 'request', requestId: 'r1', operation: 'final', payload: { id: 'q1' }, protocol });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(frames[0].identity.role, 'sender');
  const response = port.sent.find(message => message.type === 'response');
  assert.equal(response.requestId, 'r1');
  assert.deepEqual(response.result, { ok: true, persisted: true });
  assert.deepEqual(response.protocol, protocol);
});

test('runtime port hub request resolves receiver response and rejects on disconnect', async () => {
  const hub = createRuntimePortHub();
  const port = fakePort(rolePortName('s1', 'receiver', 'i2'), 20);
  hub.connect(port);
  const protocol = await completeHandshake(port);
  const first = hub.request('s1', 'receiver', { operation: 'deliver', payload: { envelope: { id: 'q1' } } });
  await Promise.resolve();
  const request = port.sent.find(message => message.type === 'request');
  port.onMessage.emit({ type: 'response', requestId: request.requestId, result: { ok: true }, protocol });
  assert.deepEqual(await first, { ok: true });

  port.sent.length = 0;
  const second = hub.request('s1', 'receiver', { operation: 'deliver', payload: {} });
  await Promise.resolve();
  port.onDisconnect.emit();
  await assert.rejects(second, /port_disconnected/);
});

test('replacing a role port rejects requests owned by the old connection', async () => {
  const hub = createRuntimePortHub();
  const oldPort = fakePort(rolePortName('s1', 'receiver', 'old'), 20);
  hub.connect(oldPort);
  await completeHandshake(oldPort);
  const pending = hub.request('s1', 'receiver', { operation: 'deliver', payload: {} });
  await Promise.resolve();
  const nextPort = fakePort(rolePortName('s1', 'receiver', 'new'), 21);
  hub.connect(nextPort);
  await assert.rejects(pending, /port_replaced/);
  assert.equal(hub.get('s1', 'receiver').instanceId, 'new');
});

test('runtime port hub opens circuit and fails fast after repeated timeouts', async () => {
  let now = 1000;
  const clock = scheduler();
  const states = [];
  const hub = createRuntimePortHub({ timeoutMs: 100, now: () => now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, onCircuitState(value) { states.push(value); } });
  const port = fakePort(rolePortName('s1', 'receiver', 'i2'), 20);
  hub.connect(port);
  await completeHandshake(port);
  const first = hub.request('s1', 'receiver', { operation: 'deliver', payload: {} });
  await Promise.resolve(); clock.fireNext();
  await assert.rejects(first, /port_request_timeout/);
  const second = hub.request('s1', 'receiver', { operation: 'deliver', payload: {} });
  await Promise.resolve(); clock.fireNext();
  await assert.rejects(second, /port_request_timeout/);
  assert.equal(hub.getTransportState('s1', 'receiver').state, 'open');
  await assert.rejects(hub.request('s1', 'receiver', { operation: 'deliver', payload: {} }), /direct_lane_degraded|port_circuit_open/);
  assert.ok(states.some(value => value.state === 'open'));
});

test('runtime port hub successful probe closes transport circuit', async () => {
  let now = 1000;
  const hub = createRuntimePortHub({ now: () => now });
  const port = fakePort(rolePortName('s1', 'receiver', 'i2'), 20);
  hub.connect(port);
  const protocol = await completeHandshake(port);
  const pending = hub.request('s1', 'receiver', { operation: 'deliver', payload: {} });
  await Promise.resolve();
  const request = port.sent.find(message => message.type === 'request');
  now = 1030;
  port.onMessage.emit({ type: 'response', requestId: request.requestId, result: { ok: true }, protocol });
  await pending;
  assert.equal(hub.getTransportState('s1', 'receiver').state, 'closed');
  assert.equal(hub.getTransportState('s1', 'receiver').lastRttMs, 30);
});

test('runtime port hub records message fallback when direct port is missing', () => {
  const states = [];
  const hub = createRuntimePortHub({ onCircuitState: value => states.push(value) });
  const state = hub.noteFallback('s1', 'receiver', 'role_port_missing');
  assert.equal(state.lastMode, 'fallback');
  assert.equal(states.at(-1).lastFailureReason, 'role_port_missing');
});
