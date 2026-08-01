import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeRolePort } from '../content/runtime-role-port.js';
import { createTransportHandshake } from '../shared/transport-protocol.js';

function event() {
  const listeners = [];
  return { addListener(fn) { listeners.push(fn); }, emit(value) { for (const fn of listeners) fn(value); } };
}

function chromeApi() {
  const ports = [];
  return {
    ports,
    runtime: {
      connect({ name }) {
        const port = {
          name,
          onMessage: event(),
          onDisconnect: event(),
          sent: [],
          postMessage(message) { this.sent.push(message); },
          disconnect() { this.onDisconnect.emit(); }
        };
        ports.push(port);
        return port;
      }
    }
  };
}

async function completeHandshake(port, { sessionId, role, instanceId, epoch = 1 }) {
  const handshake = createTransportHandshake({ sessionId, role, instanceId });
  port.onMessage.emit({ type: 'transport_handshake_offer', handshake, epoch });
  await Promise.resolve();
  const accepted = port.sent.find(message => message.type === 'transport_handshake_accept');
  assert.equal(accepted?.protocol?.epoch, epoch);
  port.onMessage.emit({ type: 'transport_handshake_result', ok: true, protocol: accepted.protocol });
  await Promise.resolve();
  port.sent.length = 0;
  return accepted.protocol;
}

test('content role port uses semantic request frames', async () => {
  const api = chromeApi();
  const runtime = createRuntimeRolePort({ chromeApi: api, sessionId: 's1', role: 'sender', instanceId: 'i1' });
  runtime.connect();
  const protocol = await completeHandshake(api.ports[0], { sessionId: 's1', role: 'sender', instanceId: 'i1' });
  const resultPromise = runtime.request('final', { envelope: { id: 'q1' } });
  await Promise.resolve();
  const request = api.ports[0].sent.find(message => message.type === 'request');
  assert.equal(request.operation, 'final');
  assert.deepEqual(request.protocol, protocol);
  api.ports[0].onMessage.emit({ type: 'response', requestId: request.requestId, result: { persisted: true }, protocol });
  assert.deepEqual(await resultPromise, { persisted: true });
});

test('content role port invokes one-time fallback after disconnect', async () => {
  const api = chromeApi();
  const runtime = createRuntimeRolePort({ chromeApi: api, sessionId: 's1', role: 'sender', instanceId: 'i1', handshakeTimeoutMs: 10 });
  runtime.connect();
  await completeHandshake(api.ports[0], { sessionId: 's1', role: 'sender', instanceId: 'i1' });
  api.ports[0].onDisconnect.emit();
  const result = await runtime.request('final', {}, { fallback: async () => ({ ok: true, persisted: true, fallback: true }) });
  assert.equal(result.fallback, true);
});

test('content role port handles service-worker delivery requests', async () => {
  const api = chromeApi();
  const runtime = createRuntimeRolePort({
    chromeApi: api,
    sessionId: 's1',
    role: 'receiver',
    instanceId: 'i2',
    async onRequest(frame) { return { ok: true, operation: frame.operation }; }
  });
  runtime.connect();
  const protocol = await completeHandshake(api.ports[0], { sessionId: 's1', role: 'receiver', instanceId: 'i2' });
  api.ports[0].onMessage.emit({ type: 'request', requestId: 'r1', operation: 'deliver', payload: {}, protocol });
  await Promise.resolve(); await Promise.resolve();
  const response = api.ports[0].sent.find(message => message.type === 'response');
  assert.equal(response.requestId, 'r1');
  assert.deepEqual(response.result, { ok: true, operation: 'deliver' });
  assert.deepEqual(response.protocol, protocol);
});
