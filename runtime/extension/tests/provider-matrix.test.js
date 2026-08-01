import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionRegistry } from '../shared/session-registry.js';
import { makeEnvelope } from '../shared/protocol.js';
import { buildSessionStatus, describeRuntimeStatus } from '../shared/session-status.js';

const providers = ['chatgpt', 'claude'];

for (const senderProvider of providers) {
  for (const receiverProvider of providers) {
    const routeName = `${senderProvider} -> ${receiverProvider}`;
    test(`${routeName} registers and routes one final through exact role ownership`, () => {
      const sessionId = `matrix-${senderProvider}-${receiverProvider}`;
      const registry = new SessionRegistry();
      const senderTabId = senderProvider === 'chatgpt' ? 101 : 102;
      const receiverTabId = receiverProvider === 'chatgpt' ? 201 : 202;
      assert.equal(registry.register({
        sessionId, role: 'sender', provider: senderProvider, tabId: senderTabId
      }, { now: 1000 }).accepted, true);
      assert.equal(registry.register({
        sessionId, role: 'receiver', provider: receiverProvider, tabId: receiverTabId
      }, { now: 1001 }).accepted, true);

      const envelope = makeEnvelope({
        sessionId,
        sourceProvider: senderProvider,
        text: `Question for ${routeName}`,
        seq: 1,
        now: 1002
      });
      assert.equal(registry.canForward(sessionId, senderTabId), true);
      const route = registry.route(sessionId, envelope);
      assert.equal(route.tabId, receiverTabId);
      assert.equal(route.message, envelope);

      const status = buildSessionStatus(registry.getSession(sessionId), 1002, 45000);
      assert.deepEqual(describeRuntimeStatus(status), { text: 'LINK OK', tone: 'ok' });
    });

    test(`${routeName} leaves absent-receiver finals to the lossless ledger`, () => {
      const sessionId = `recovery-${senderProvider}-${receiverProvider}`;
      const registry = new SessionRegistry();
      const senderTabId = senderProvider === 'chatgpt' ? 301 : 302;
      const receiverTabId = receiverProvider === 'chatgpt' ? 401 : 402;
      registry.register({
        sessionId, role: 'sender', provider: senderProvider, tabId: senderTabId
      }, { now: 2000 });
      const first = makeEnvelope({
        sessionId, sourceProvider: senderProvider, text: 'First final', seq: 1, now: 2001
      });
      const latest = makeEnvelope({
        sessionId, sourceProvider: senderProvider, text: 'Latest final', seq: 2, now: 2002
      });
      assert.equal(registry.route(sessionId, first), null);
      assert.equal(registry.route(sessionId, latest), null);
      assert.equal('pending' in registry.getSession(sessionId), false);
      registry.register({
        sessionId, role: 'receiver', provider: receiverProvider, tabId: receiverTabId
      }, { now: 2003 });
      assert.equal(registry.route(sessionId, first).message.id, first.id);
      assert.equal(registry.route(sessionId, latest).message.id, latest.id);
    });
  }
}
