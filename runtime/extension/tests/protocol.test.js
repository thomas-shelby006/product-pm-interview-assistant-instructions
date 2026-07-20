import test from 'node:test';
import assert from 'node:assert/strict';

const protocol = await import('../shared/protocol.js').catch(() => null);
const registryModule = await import('../shared/session-registry.js').catch(() => null);

test('runtime config parses explicit query parameters', () => {
  assert.ok(protocol, 'protocol module must exist');
  const result = protocol.parseRuntimeConfig(
    'https://claude.ai/new?pmia_session=s1&pmia_role=receiver&pmia_provider=claude'
  );
  assert.deepEqual(result, { sessionId: 's1', role: 'receiver', provider: 'claude' });
});

test('runtime config rejects unsupported provider and role', () => {
  assert.ok(protocol, 'protocol module must exist');
  assert.equal(protocol.parseRuntimeConfig('https://chatgpt.com/?pmia_role=other'), null);
  assert.equal(protocol.parseRuntimeConfig('https://chatgpt.com/?pmia_provider=gemini'), null);
});

test('message envelope trims text and preserves metadata', () => {
  assert.ok(protocol, 'protocol module must exist');
  const result = protocol.makeEnvelope({
    sessionId: 'session-1',
    sourceProvider: 'chatgpt',
    text: '  latest question  ',
    kind: 'question',
    metadata: { buffered: false },
    now: 123
  });
  assert.equal(result.text, 'latest question');
  assert.equal(result.createdAt, 123);
  assert.equal(result.kind, 'question');
  assert.deepEqual(result.metadata, { buffered: false });
});

test('session registry replaces stale receiver and routes to current receiver', () => {
  assert.ok(registryModule, 'session registry module must exist');
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'chatgpt', tabId: 10 });
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 11 });
  const route = registry.route('s1', { id: 'm1', text: 'q' });
  assert.deepEqual(route, { tabId: 11, message: { id: 'm1', text: 'q' } });
});

test('session registry keeps only latest queued message until receiver registers', () => {
  assert.ok(registryModule, 'session registry module must exist');
  const registry = new registryModule.SessionRegistry();
  assert.equal(registry.route('s1', { id: 'm1', text: 'first' }), null);
  assert.equal(registry.route('s1', { id: 'm2', text: 'latest' }), null);
  const registration = registry.register({
    sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 20
  });
  assert.deepEqual(registration.pending, { id: 'm2', text: 'latest' });
});

test('unregister removes only matching tab registration', () => {
  assert.ok(registryModule, 'session registry module must exist');
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 1 });
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 2 });
  registry.unregister(1);
  assert.equal(registry.getSession('s1').sender, null);
  assert.equal(registry.getSession('s1').receiver.tabId, 2);
});
