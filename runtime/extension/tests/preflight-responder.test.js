import test from 'node:test';
import assert from 'node:assert/strict';

const responderModule = await import('../content/preflight-responder.js').catch(() => null);

test('preflight responder reports runtime identity and reads composer availability only', () => {
  assert.ok(responderModule, 'preflight responder module must exist');
  const calls = [];
  const respond = responderModule.createPreflightResponder({
    runtimeConfig: { sessionId: 's1', role: 'receiver', provider: 'claude' },
    version: '0.5.1',
    instanceId: 'runtime-1',
    adapter: {
      findComposer() { calls.push('findComposer'); return { focus() {} }; },
      getConversationMessages() { throw new Error('must not read messages'); },
      isGenerating() { throw new Error('must not inspect generation'); },
      setComposerText() { throw new Error('must not write'); },
      submit() { throw new Error('must not submit'); },
      stopGenerating() { throw new Error('must not stop'); }
    }
  });
  assert.deepEqual(respond(), {
    ok: true, sessionId: 's1', role: 'receiver', provider: 'claude',
    version: '0.5.1', instanceId: 'runtime-1', composerAvailable: true,
    capabilities: {
      composerFinder: true, messageReader: true, composerWriter: true, submit: true,
      generationState: true, stopGeneration: true, microphoneToggle: false, voiceState: false,
      required: ['composerFinder', 'messageReader', 'composerWriter', 'submit', 'generationState'],
      missingRequired: [], complete: true
    }
  });
  assert.deepEqual(calls, ['findComposer']);
});

test('preflight responder tolerates a missing provider composer', () => {
  assert.ok(responderModule, 'preflight responder module must exist');
  const respond = responderModule.createPreflightResponder({
    runtimeConfig: { sessionId: 's2', role: 'sender', provider: 'chatgpt' },
    version: '0.5.1',
    adapter: { findComposer: () => null }
  });
  assert.equal(respond().composerAvailable, false);
  assert.equal(respond().instanceId, '');
});