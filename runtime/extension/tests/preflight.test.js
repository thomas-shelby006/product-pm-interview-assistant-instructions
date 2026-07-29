import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionRegistry } from '../shared/session-registry.js';

const preflightModule = await import('../shared/preflight.js').catch(() => null);

function registryWithRoles(now = 10_000) {
  const registry = new SessionRegistry();
  registry.register({
    sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 11
  }, { now, staleAfterMs: 45_000 });
  registry.register({
    sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 22
  }, { now, staleAfterMs: 45_000 });
  return registry;
}

test('active preflight pings the opposite live role and normalizes its reply', async () => {
  assert.ok(preflightModule, 'preflight module must exist');
  const registry = registryWithRoles();
  const calls = [];
  const result = await preflightModule.runCounterpartPreflight({
    registry, sessionId: 's1', requesterTabId: 11, now: 10_100,
    staleAfterMs: 45_000,
    async sendToTab(tabId, message) {
      calls.push([tabId, message]);
      return {
        ok: true, role: 'receiver', provider: 'claude',
        version: '0.5.1', composerAvailable: true
      };
    }
  });
  assert.equal(calls[0][0], 22);
  assert.equal(calls[0][1].type, 'PMIA_PREFLIGHT_PING');
  assert.equal(result.ok, true);
  assert.deepEqual(result.counterpart, {
    responsive: true, role: 'receiver', provider: 'claude',
    version: '0.5.1', composerAvailable: true, reason: ''
  });
  assert.equal(result.status.sender.connected, true);
  assert.equal(result.status.receiver.connected, true);
});
test('active preflight reports a missing counterpart without sending', async () => {
  assert.ok(preflightModule, 'preflight module must exist');
  const registry = new SessionRegistry();
  registry.register({
    sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 11
  }, { now: 10_000, staleAfterMs: 45_000 });
  let sent = false;
  const result = await preflightModule.runCounterpartPreflight({
    registry, sessionId: 's1', requesterTabId: 11, now: 10_100,
    staleAfterMs: 45_000,
    sendToTab: async () => { sent = true; }
  });
  assert.equal(sent, false);
  assert.equal(result.ok, true);
  assert.equal(result.counterpart.responsive, false);
  assert.equal(result.counterpart.role, 'receiver');
  assert.equal(result.counterpart.reason, 'missing');
});

test('active preflight pings present counterparts even after heartbeat age expires', async () => {
  assert.ok(preflightModule, 'preflight module must exist');
  const registry = registryWithRoles(10_000);
  let calls = 0;
  const recovered = await preflightModule.runCounterpartPreflight({
    registry, sessionId: 's1', requesterTabId: 11, now: 60_001,
    staleAfterMs: 45_000,
    sendToTab: async () => {
      calls += 1;
      return { ok: true, role: 'receiver', provider: 'claude', version: '0.6.0', composerAvailable: true };
    }
  });
  assert.equal(calls, 1);
  assert.equal(recovered.counterpart.responsive, true);
  assert.equal(recovered.status.receiver.connected, true);
  assert.equal(recovered.status.receiver.stale, true);

  const unreachable = await preflightModule.runCounterpartPreflight({
    registry, sessionId: 's1', requesterTabId: 11, now: 60_001,
    staleAfterMs: 45_000,
    sendToTab: async () => { throw new Error('port closed'); }
  });
  assert.equal(unreachable.counterpart.responsive, false);
  assert.equal(unreachable.counterpart.reason, 'unreachable');
  assert.equal(unreachable.counterpart.provider, 'claude');
});
test('active preflight rejects a tab that does not own the session', async () => {
  assert.ok(preflightModule, 'preflight module must exist');
  const result = await preflightModule.runCounterpartPreflight({
    registry: registryWithRoles(),
    sessionId: 's1', requesterTabId: 99, now: 10_100,
    staleAfterMs: 45_000,
    sendToTab: async () => { throw new Error('must not send'); }
  });
  assert.deepEqual(result, { ok: false, error: 'session_not_owned' });
});