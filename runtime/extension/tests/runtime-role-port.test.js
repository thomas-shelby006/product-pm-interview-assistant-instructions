import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeRolePort } from '../content/runtime-role-port.js';

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

test('content role port uses semantic request frames', async () => {
  const api = chromeApi();
  const runtime = createRuntimeRolePort({ chromeApi: api, sessionId: 's1', role: 'sender', instanceId: 'i1' });
  runtime.connect();
  const resultPromise = runtime.request('final', { envelope: { id: 'q1' } });
  const request = api.ports[0].sent[0];
  assert.equal(request.operation, 'final');
  api.ports[0].onMessage.emit({ type: 'response', requestId: request.requestId, result: { persisted: true } });
  assert.deepEqual(await resultPromise, { persisted: true });
});

test('content role port invokes one-time fallback after disconnect', async () => {
  const api = chromeApi();
  const runtime = createRuntimeRolePort({ chromeApi: api, sessionId: 's1', role: 'sender', instanceId: 'i1' });
  runtime.connect();
  api.ports[0].onDisconnect.emit();
  const result = await runtime.request('final', {}, {
    fallback: async () => ({ ok: true, persisted: true, fallback: true })
  });
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
  api.ports[0].onMessage.emit({ type: 'request', requestId: 'r1', operation: 'deliver', payload: {} });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(api.ports[0].sent[0], {
    type: 'response', requestId: 'r1', result: { ok: true, operation: 'deliver' }
  });
});
