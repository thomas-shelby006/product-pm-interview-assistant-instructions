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

test('session registry rejects a duplicate live role and permits stale takeover', () => {
  assert.ok(registryModule, 'session registry module must exist');
  const registry = new registryModule.SessionRegistry();
  const first = registry.register(
    { sessionId: 's1', role: 'receiver', provider: 'chatgpt', tabId: 10 },
    { now: 1000, staleAfterMs: 45000 }
  );
  const conflict = registry.register(
    { sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 11 },
    { now: 2000, staleAfterMs: 45000 }
  );
  assert.equal(first.accepted, true);
  assert.equal(conflict.accepted, false);
  assert.equal(conflict.conflict, true);
  assert.equal(registry.route('s1', { id: 'm1', text: 'q' }).tabId, 10);

  const takeover = registry.register(
    { sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 11 },
    { now: 46001, staleAfterMs: 45000 }
  );
  assert.equal(takeover.accepted, true);
  assert.equal(registry.route('s1', { id: 'm2', text: 'latest' }).tabId, 11);
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


test('session registry survives service-worker restart through exported state', () => {
  assert.ok(registryModule, 'session registry module must exist');
  const first = new registryModule.SessionRegistry();
  first.register({ sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 1 });
  first.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 2 });
  first.route('s2', { id: 'pending', text: 'latest' });

  const restarted = new registryModule.SessionRegistry(first.exportState());
  assert.equal(restarted.getSession('s1').sender.tabId, 1);
  assert.equal(restarted.getSession('s1').receiver.tabId, 2);
  const registration = restarted.register({
    sessionId: 's2', role: 'receiver', provider: 'chatgpt', tabId: 3
  });
  assert.deepEqual(registration.pending, { id: 'pending', text: 'latest' });
});


test('session registry authorizes only the registered sender tab', () => {
  const registry = new registryModule.SessionRegistry();
  registry.register(
    { sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 7 },
    { now: 1000 }
  );
  assert.equal(registry.canForward('s1', 7), true);
  assert.equal(registry.canForward('s1', 8), false);
  assert.equal(registry.canForward('missing', 7), false);
});

test('session registry force-queues the latest receiver-rejected envelope', () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 2 });
  registry.queueLatest('s1', { id: 'm1', text: 'first' });
  registry.queueLatest('s1', { id: 'm2', text: 'latest' });
  registry.unregister(2);
  const registration = registry.register({
    sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 3
  });
  assert.deepEqual(registration.pending, { id: 'm2', text: 'latest' });
});

test('same-tab registration is a heartbeat rather than a new ownership event', () => {
  const registry = new registryModule.SessionRegistry();
  const first = registry.register(
    { sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 5 },
    { now: 1000 }
  );
  const heartbeat = registry.register(
    { sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 5 },
    { now: 2000 }
  );
  assert.equal(first.changed, true);
  assert.equal(heartbeat.changed, false);
  assert.equal(heartbeat.accepted, true);
  assert.equal(registry.getSession('s1').sender.registeredAt, 2000);
});

test('session registry recognizes either registered role as a session owner', () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 7 });
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 8 });
  assert.equal(registry.ownsTab('s1', 7), true);
  assert.equal(registry.ownsTab('s1', 8), true);
  assert.equal(registry.ownsTab('s1', 9), false);
});

test('message envelope preserves a positive sender sequence', () => {
  const result = protocol.makeEnvelope({
    sessionId: 's1',
    sourceProvider: 'chatgpt',
    text: 'What is the north-star metric?',
    seq: 7,
    now: 123
  });
  assert.equal(result.seq, 7);
  assert.equal(protocol.isEnvelope(result), true);
});

test('session registry rejects duplicate and stale sender sequences', () => {
  const registry = new registryModule.SessionRegistry();
  assert.deepEqual(registry.acceptSequence('s1', 1), {
    accepted: true, reason: 'new', lastAcceptedSeq: 1
  });
  assert.deepEqual(registry.acceptSequence('s1', 1), {
    accepted: false, reason: 'duplicate', lastAcceptedSeq: 1
  });
  assert.deepEqual(registry.acceptSequence('s1', 0), {
    accepted: true, reason: 'unsequenced', lastAcceptedSeq: 1
  });
  assert.deepEqual(registry.acceptSequence('s1', 3), {
    accepted: true, reason: 'new', lastAcceptedSeq: 3
  });
  assert.deepEqual(registry.acceptSequence('s1', 2), {
    accepted: false, reason: 'stale', lastAcceptedSeq: 3
  });
});

test('session registry persists the last accepted sequence through restart', () => {
  const registry = new registryModule.SessionRegistry();
  registry.acceptSequence('s1', 9);
  const restarted = new registryModule.SessionRegistry(registry.exportState());
  assert.deepEqual(restarted.acceptSequence('s1', 9), {
    accepted: false, reason: 'duplicate', lastAcceptedSeq: 9
  });
  assert.deepEqual(restarted.acceptSequence('s1', 10), {
    accepted: true, reason: 'new', lastAcceptedSeq: 10
  });
});

test('latest sequenced message replaces older pending work', () => {
  const registry = new registryModule.SessionRegistry();
  registry.acceptSequence('s1', 1);
  registry.route('s1', { id: 'a', seq: 1, text: 'A' });
  registry.acceptSequence('s1', 2);
  registry.route('s1', { id: 'b', seq: 2, text: 'B' });
  registry.acceptSequence('s1', 3);
  registry.route('s1', { id: 'c', seq: 3, text: 'C' });
  const registration = registry.register({
    sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 2
  });
  assert.deepEqual(registration.pending, { id: 'c', seq: 3, text: 'C' });
});

test('session registry resolves the owned role for a tab', () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 4 });
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 5 });
  assert.equal(registry.roleForTab('s1', 4), 'sender');
  assert.equal(registry.roleForTab('s1', 5), 'receiver');
  assert.equal(registry.roleForTab('s1', 6), null);
});