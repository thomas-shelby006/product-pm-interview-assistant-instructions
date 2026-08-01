import test from 'node:test';
import assert from 'node:assert/strict';

const protocol = await import('../shared/protocol.js').catch(() => null);
const registryModule = await import('../shared/session-registry.js').catch(() => null);
const dashboardProtocol = await import('../shared/dashboard-protocol.js').catch(() => null);

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
  assert.equal(result.metadata.buffered, false);
  assert.match(result.metadata.traceId, /^tr-[0-9a-f]{8}$/);
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



test('session registry routes but never stores delivery payloads', () => {
  const registry = new registryModule.SessionRegistry();
  const envelope = { id: 'q1', seq: 1, text: 'Protected by the delivery ledger' };
  assert.equal(registry.route('s1', envelope), null);
  assert.deepEqual(registry.exportState(), []);
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 20 });
  assert.deepEqual(registry.route('s1', envelope), { tabId: 20, message: envelope });
  assert.equal('pending' in registry.getSession('s1'), false);
  assert.equal('lastAcceptedSeq' in registry.getSession('s1'), false);
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


test('session registry survives service-worker restart with exact role ownership', () => {
  const first = new registryModule.SessionRegistry();
  first.register({ sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 1, instanceId: 'sender-1' });
  first.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 2, instanceId: 'receiver-1' });
  const restarted = new registryModule.SessionRegistry(first.exportState());
  assert.equal(restarted.getSession('s1').sender.tabId, 1);
  assert.equal(restarted.getSession('s1').receiver.tabId, 2);
  assert.equal(restarted.canForward('s1', 1, 'sender-1'), true);
  assert.equal(restarted.ownsTab('s1', 2, 'receiver-1'), true);
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




test('session registry resolves the owned role for a tab', () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 4 });
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 5 });
  assert.equal(registry.roleForTab('s1', 4), 'sender');
  assert.equal(registry.roleForTab('s1', 5), 'receiver');
  assert.equal(registry.roleForTab('s1', 6), null);
});



test('session registry removes an entire role-ownership session', () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 1 });
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 2 });
  assert.equal(registry.removeSession('s1'), true);
  assert.equal(registry.getSession('s1'), null);
  assert.equal(registry.removeSession('s1'), false);
});


test('unregister reports affected sessions for lifecycle cleanup', () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 1 });
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 2 });
  registry.register({ sessionId: 's2', role: 'sender', provider: 'chatgpt', tabId: 3 });
  assert.deepEqual(registry.unregister(1), ['s1']);
  assert.deepEqual(registry.unregister(999), []);
});

test('same-tab replacement runtime takes ownership without revoking the new instance', () => {
  const registry = new registryModule.SessionRegistry();
  const first = registry.register({
    sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 5, instanceId: 'old-runtime'
  }, { now: 1000 });
  const replacement = registry.register({
    sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 5, instanceId: 'new-runtime'
  }, { now: 2000 });
  assert.equal(first.changed, true);
  assert.equal(replacement.accepted, true);
  assert.equal(replacement.changed, true);
  assert.equal(replacement.replacedTabId, 5);
  assert.equal(replacement.replacedRegistration.instanceId, 'old-runtime');
  assert.equal(registry.getSession('s1').sender.instanceId, 'new-runtime');
  assert.equal(registry.canForward('s1', 5, 'old-runtime'), false);
  assert.equal(registry.canForward('s1', 5, 'new-runtime'), true);
});

test('same runtime instance remains a heartbeat and survives service-worker restart', () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({
    sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 5, instanceId: 'runtime-1'
  }, { now: 1000 });
  const heartbeat = registry.register({
    sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 5, instanceId: 'runtime-1'
  }, { now: 2000 });
  assert.equal(heartbeat.changed, false);
  const restored = new registryModule.SessionRegistry(registry.exportState());
  assert.equal(restored.getSession('s1').sender.instanceId, 'runtime-1');
  assert.equal(restored.ownsTab('s1', 5, 'runtime-1'), true);
  assert.equal(restored.ownsTab('s1', 5, 'other-runtime'), false);
});

test('runtime lease migrates ownership to a replacement tab without a live-role conflict', () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({
    sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 5, instanceId: 'lease-1'
  }, { now: 1000 });
  const migrated = registry.register({
    sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 9, instanceId: 'lease-1'
  }, { now: 1100 });
  assert.equal(migrated.accepted, true);
  assert.equal(migrated.changed, true);
  assert.equal(migrated.replacedTabId, 5);
  assert.equal(registry.getSession('s1').sender.tabId, 9);
  assert.equal(registry.canForward('s1', 5, 'lease-1'), false);
  assert.equal(registry.canForward('s1', 9, 'lease-1'), true);
});


test('runtime lease migration can be denied for an inactive duplicate tab', () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({
    sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 5, instanceId: 'lease-1'
  }, { now: 1000 });
  const duplicate = registry.register({
    sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 9, instanceId: 'lease-1'
  }, { now: 1100, allowInstanceMigration: false });
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.conflict, true);
  assert.equal(registry.getSession('s1').sender.tabId, 5);
});


test('dashboard protocol accepts explicit draft conflict resolution commands', () => {
  for (const command of ['resolve_draft_keep_manual', 'resolve_draft_restore_pmia', 'resolve_draft_merge']) {
    assert.equal(dashboardProtocol.normalizeDashboardCommand({ sessionId: 's', requestId: command, command, payload: {} })?.command, command);
  }
});


test('dashboard protocol normalizes prepare and confirmed end payloads', () => {
  assert.equal(dashboardProtocol.normalizeDashboardCommand({ sessionId: 's', requestId: 'p', command: 'prepare_end_session', payload: {} })?.command, 'prepare_end_session');
  const end = dashboardProtocol.normalizeDashboardCommand({ sessionId: 's', requestId: 'e', command: 'end_session', payload: { confirmToken: 'token', mode: 'archive_and_end' } });
  assert.equal(end.payload.confirmToken, 'token');
  assert.equal(end.payload.mode, 'archive_and_end');
});


test('dashboard protocol accepts active runtime self-test', () => {
  assert.equal(dashboardProtocol.normalizeDashboardCommand({ sessionId: 's', requestId: 'self-test', command: 'run_self_test', payload: {} })?.command, 'run_self_test');
});
