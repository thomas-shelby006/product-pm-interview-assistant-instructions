import test from 'node:test';
import assert from 'node:assert/strict';

const previewModule = await import('../shared/preview.js').catch(() => null);
const registryModule = await import('../shared/session-registry.js').catch(() => null);

test('preview contract trims text and preserves turn revision', () => {
  assert.ok(previewModule, 'preview module must exist');
  const preview = previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'claude', text: '  growing question  ',
    turnKey: 'voice-7', revision: 3, phase: 'interim', now: 123
  });
  assert.deepEqual(preview, {
    sessionId: 's1', sourceProvider: 'claude', text: 'growing question',
    turnKey: 'voice-7', revision: 3, phase: 'interim', createdAt: 123
  });
  assert.equal(previewModule.isPreview(preview), true);
});

test('preview route validates sender ownership without mutating durable state', () => {
  assert.ok(previewModule, 'preview module must exist');
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 10 });
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 20 });
  const before = registry.exportState();
  const preview = previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'chatgpt', text: 'partial',
    turnKey: 'turn-1', revision: 2
  });
  assert.deepEqual(previewModule.routePreview(registry, preview, 10), {
    accepted: true, tabId: 20, reason: 'receiver_ready'
  });
  assert.deepEqual(registry.exportState(), before);
});

test('preview route rejects non-owner and drops when receiver is absent', () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'sender', provider: 'claude', tabId: 10 });
  const preview = previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'claude', text: 'partial question',
    turnKey: 'voice-1', revision: 1
  });
  assert.deepEqual(previewModule.routePreview(registry, preview, 11), {
    accepted: false, tabId: null, reason: 'sender_not_registered'
  });
  assert.deepEqual(previewModule.routePreview(registry, preview, 10), {
    accepted: true, tabId: null, reason: 'receiver_absent'
  });
  const registration = registry.register({
    sessionId: 's1', role: 'receiver', provider: 'chatgpt', tabId: 20
  });
  assert.equal('pending' in registration, false);
});

test('preview contract rejects missing identity and invalid revision', () => {
  assert.throws(() => previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'chatgpt', text: 'partial',
    turnKey: '', revision: 1
  }), /Invalid PMIA preview/);
  assert.throws(() => previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'chatgpt', text: 'partial',
    turnKey: 'turn-1', revision: 0
  }), /Invalid PMIA preview/);
});

test('preview delivery is direct, disposable, and never creates pending work', async () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 10 });
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 20 });
  const preview = previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'chatgpt', text: 'how would you',
    turnKey: 'turn-1', revision: 1
  });
  const sent = [];
  const before = registry.exportState();
  const outcome = await previewModule.deliverPreview({
    registry, preview, senderTabId: 10,
    sendToTab: async (tabId, message) => { sent.push([tabId, message]); return { ok: true }; }
  });
  assert.deepEqual(outcome, { ok: true, delivered: true, dropped: false, reason: 'delivered' });
  assert.deepEqual(sent, [[20, { type: 'PMIA_PREVIEW_DELIVER', preview }]]);
  assert.deepEqual(registry.exportState(), before);
});

test('preview delivery drops absent or unreachable receivers without queueing', async () => {
  const registry = new registryModule.SessionRegistry();
  registry.register({ sessionId: 's1', role: 'sender', provider: 'claude', tabId: 10 });
  const preview = previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'claude', text: 'partial',
    turnKey: 'voice-1', revision: 1
  });
  assert.deepEqual(await previewModule.deliverPreview({
    registry, preview, senderTabId: 10, sendToTab: async () => { throw new Error('must not send'); }
  }), { ok: true, delivered: false, dropped: true, reason: 'receiver_absent' });
  registry.register({ sessionId: 's1', role: 'receiver', provider: 'chatgpt', tabId: 20 });
  assert.deepEqual(await previewModule.deliverPreview({
    registry, preview, senderTabId: 10, sendToTab: async () => { throw new Error('offline'); }
  }), { ok: true, delivered: false, dropped: true, reason: 'receiver_unreachable' });
  assert.equal(registry.getSession('s1').pending, null);
});

test('preview contract permits empty text only for an explicit clear phase', () => {
  const clear = previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'claude', text: '',
    turnKey: 'claude-voice-1', revision: 3, phase: 'clear', now: 10
  });
  assert.equal(previewModule.isPreview(clear), true);
  assert.deepEqual(clear, {
    sessionId: 's1', sourceProvider: 'claude', text: '',
    turnKey: 'claude-voice-1', revision: 3, phase: 'clear', createdAt: 10
  });
  assert.throws(() => previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'claude', text: '',
    turnKey: 'claude-voice-1', revision: 3, phase: 'interim'
  }), /Invalid PMIA preview/);
});

test('preview contract carries an optional independent global sequence', () => {
  const preview = previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'chatgpt', text: 'partial',
    turnKey: 'u1', revision: 2, seq: 9, now: 20
  });
  assert.equal(preview.seq, 9);
  assert.equal(previewModule.isPreview(preview), true);
  assert.throws(() => previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'chatgpt', text: 'partial',
    turnKey: 'u1', revision: 2, seq: -1
  }), /Invalid PMIA preview/);
});

test('preview contract carries a page-lifetime stream identity', () => {
  const preview = previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'chatgpt', text: 'partial',
    turnKey: 'u1', revision: 2, seq: 1,
    streamId: 'page-a', now: 30
  });
  assert.equal(preview.streamId, 'page-a');
  assert.equal(previewModule.isPreview(preview), true);
  assert.throws(() => previewModule.makePreview({
    sessionId: 's1', sourceProvider: 'chatgpt', text: 'partial',
    turnKey: 'u1', revision: 2, streamId: '   '
  }), /Invalid PMIA preview/);
});