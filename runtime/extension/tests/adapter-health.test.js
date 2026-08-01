import test from 'node:test';
import assert from 'node:assert/strict';
import { describeAdapterCapabilities } from '../content/adapter-health.js';

test('receiver adapter capability report requires rendered-turn and submission surfaces', () => {
  const result = describeAdapterCapabilities({
    findComposer() {},
    getConversationMessages() {},
    setComposerText() {},
    getComposerText() {},
    submit() {},
    isGenerating() {}
  }, 'receiver');
  assert.equal(result.complete, true);
  assert.deepEqual(result.missingRequired, []);
});

test('adapter capability report identifies the exact missing required surfaces', () => {
  const result = describeAdapterCapabilities({ findComposer() {} }, 'receiver');
  assert.equal(result.complete, false);
  assert.deepEqual(result.missingRequired, [
    'messageReader', 'composerWriter', 'composerReader', 'submit', 'generationState'
  ]);
});
