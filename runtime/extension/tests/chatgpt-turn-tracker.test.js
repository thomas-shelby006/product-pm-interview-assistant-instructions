import test from 'node:test';
import assert from 'node:assert/strict';

const trackerModule = await import('../content/senders/chatgpt-turn-tracker.js').catch(() => null);

const message = (id, role, text) => ({ id, turnId: id, role, text });

function createTracker(options = {}) {
  assert.ok(trackerModule, 'ChatGPT turn tracker module must exist');
  return trackerModule.createChatGptTurnTracker({ fallbackMs: 5000, ...options });
}

test('captured ChatGPT voice progression never emits a partial user turn', () => {
  const tracker = createTracker();
  tracker.prime([]);
  assert.deepEqual(tracker.update([message('u1', 'user', 'Hey, hi')], 0), []);
  assert.deepEqual(tracker.update([message('u1', 'user', 'Hey, hi, I want to')], 1000), []);
  assert.deepEqual(tracker.update([
    message('u1', 'user', 'Hey, hi, I want to introduce myself to you')
  ], 2000), []);
  assert.deepEqual(tracker.poll(8000, { allowFallback: false }), []);
});

test('following assistant turn finalizes the complete preceding user message', () => {
  const tracker = createTracker();
  tracker.prime([]);
  tracker.update([message('u1', 'user', 'Please introduce yourself to me')], 0);
  const emitted = tracker.update([
    message('u1', 'user', 'Please introduce yourself to me'),
    message('a1', 'assistant', "Sure! I'm ChatGPT")
  ], 900);
  assert.deepEqual(emitted, [{
    id: 'u1',
    text: 'Please introduce yourself to me',
    boundary: 'assistant_successor'
  }]);
  assert.deepEqual(tracker.update([
    message('u1', 'user', 'Please introduce yourself to me'),
    message('a1', 'assistant', "Sure! I'm ChatGPT")
  ], 1200), []);
});

test('text growth on one message identity resets fallback timing', () => {
  const tracker = createTracker();
  tracker.prime([]);
  tracker.update([message('u1', 'user', 'How would')], 0);
  tracker.update([message('u1', 'user', 'How would you prioritize this launch?')], 4000);
  assert.deepEqual(tracker.poll(8999, { allowFallback: true }), []);
  assert.equal(tracker.poll(9000, { allowFallback: true })[0].text, 'How would you prioritize this launch?');
});

test('historical messages are baselined and never emitted after reload', () => {
  const tracker = createTracker();
  tracker.prime([
    message('old-u', 'user', 'Old interview question?'),
    message('old-a', 'assistant', 'Old answer')
  ]);
  assert.deepEqual(tracker.update([
    message('old-u', 'user', 'Old interview question?'),
    message('old-a', 'assistant', 'Old answer')
  ], 1000), []);
});

test('composer drafts are outside automatic turn tracking', () => {
  const tracker = createTracker();
  tracker.prime([]);
  assert.deepEqual(tracker.update([], 0, { composerText: 'Unsent typed draft' }), []);
  assert.deepEqual(tracker.poll(10000, { allowFallback: true }), []);
});

test('external final suppresses a later DOM copy of the same turn', () => {
  const tracker = createTracker();
  tracker.prime([]);
  tracker.markExternalFinal({ id: 'voice-1', text: 'Final Claude-compatible text' });
  const emitted = tracker.update([
    message('voice-1', 'user', 'Final Claude-compatible text'),
    message('a1', 'assistant', 'Answer')
  ], 1000);
  assert.deepEqual(emitted, []);
});

test('only the user message immediately followed by an assistant turn is finalized', () => {
  const tracker = createTracker();
  tracker.prime([]);
  const emitted = tracker.update([
    message('u1', 'user', 'Earlier provisional fragment'),
    message('u2', 'user', 'What is the final strategy question?'),
    message('a1', 'assistant', 'I would begin with the goal')
  ], 1000);
  assert.deepEqual(emitted, [{
    id: 'u2',
    text: 'What is the final strategy question?',
    boundary: 'assistant_successor'
  }]);
});
test('distinct ChatGPT tail growth exposes ordered preview revisions', () => {
  const tracker = createTracker();
  tracker.prime([]);
  tracker.update([message('u1', 'user', 'So I')], 0);
  assert.deepEqual(tracker.takePreview(), {
    turnKey: 'u1', text: 'So I', revision: 1, phase: 'interim'
  });
  tracker.update([message('u1', 'user', 'So I')], 50);
  assert.equal(tracker.takePreview(), null);
  tracker.update([message('u1', 'user', 'So I want you to help me')], 100);
  assert.deepEqual(tracker.takePreview(), {
    turnKey: 'u1', text: 'So I want you to help me', revision: 2, phase: 'interim'
  });
  assert.deepEqual(tracker.poll(6000, { allowFallback: false }), []);
});

test('finalization clears any pending preview for the committed turn', () => {
  const tracker = createTracker();
  tracker.prime([]);
  tracker.update([message('u1', 'user', 'How would you prioritize?')], 0);
  assert.ok(tracker.takePreview());
  tracker.update([
    message('u1', 'user', 'How would you prioritize?'),
    message('a1', 'assistant', 'I would start with impact')
  ], 500);
  assert.equal(tracker.takePreview(), null);
});


test('turn tracking stays bounded across a 2000-turn session', () => {
  const tracker = createTracker({ historyLimit: 64 });
  tracker.prime([]);
  const conversation = [];
  let emittedCount = 0;
  for (let index = 0; index < 2000; index += 1) {
    const user = message(`u-${index}`, 'user', `How would you prioritize launch ${index}?`);
    conversation.push(user);
    tracker.update(conversation, index * 2);
    tracker.takePreview();
    conversation.push(message(`a-${index}`, 'assistant', `Answer ${index}`));
    emittedCount += tracker.update(conversation, index * 2 + 1).length;
  }
  assert.equal(emittedCount, 2000);
  assert.ok(tracker.emittedIds.size <= 64);
  assert.ok(tracker.previewRevisions.size <= 64);
  assert.ok(tracker.lastScanSize <= 128);
});

test('rendered turn fingerprint suppresses replacement IDs but permits a genuine repeated turn', () => {
  const tracker = createTracker({ fallbackMs: 5000, duplicateTextWindowMs: 30000 });
  tracker.prime([]);
  const firstUser = message('dom-user-1', 'user', 'What is the product strategy?');
  const firstAssistant = message('dom-assistant-1', 'assistant', 'I would start with the target outcome.');
  const first = tracker.update([firstUser, firstAssistant], 1000);
  assert.equal(first.length, 1);

  const rerendered = tracker.update([
    message('dom-user-99', 'user', 'What is the product strategy?'),
    message('dom-assistant-99', 'assistant', 'A changing assistant copy must not make this a new question.')
  ], 4000);
  assert.deepEqual(rerendered, []);

  const laterRepeat = tracker.update([
    firstUser,
    firstAssistant,
    message('dom-user-100', 'user', 'What is the product strategy?'),
    message('dom-assistant-100', 'assistant', 'Here is a later answer.')
  ], 5000);
  assert.equal(laterRepeat.length, 1);
});

test('stable tail fallback survives ChatGPT navigation and assistant streaming without duplicate finals', () => {
  const tracker = createTracker({ fallbackMs: 300, duplicateTextWindowMs: 30000 });
  tracker.prime([]);
  const text = 'PMIA_060_CGCG_TEST. Reply exactly PMIA_060_CGCG_OK.';

  tracker.update([message('project-home-user', 'user', text)], 0);
  assert.deepEqual(tracker.poll(350, { allowFallback: true }), [{
    id: 'project-home-user',
    text,
    boundary: 'stable_tail_fallback'
  }]);

  assert.deepEqual(tracker.update([
    message('conversation-user-partial', 'user', text),
    message('conversation-assistant-partial', 'assistant', 'PMIA_060')
  ], 700), []);

  assert.deepEqual(tracker.update([
    message('conversation-user-final', 'user', text),
    message('conversation-assistant-final', 'assistant', 'PMIA_060_CGCG_OK')
  ], 1100), []);
});

test('authoritative Claude final suppresses one altered DOM shadow from captured evidence', () => {
  const tracker = createTracker({ externalShadowMs: 8000 });
  tracker.prime([]);
  tracker.markExternalFinal({
    id: 'voice-final-1',
    text: 'PMIA_CLCG_20260729_144000. Reply exactly PMIA_CLCG_OK.',
    now: 1000
  });

  const emitted = tracker.update([
    message(
      'claude-dom-user-1',
      'user',
      'PMIACLCG20260729144000. PMIA_CLCG_20260729_144000. Reply exactly PMIA_CLCG_OK.'
    ),
    message('claude-dom-assistant-1', 'assistant', 'PMIA_CLCG_OK')
  ], 2400);

  assert.deepEqual(emitted, []);
  assert.ok(tracker.emittedIds.has('claude-dom-user-1'));
});

test('external final shadow is one-shot and expires before a genuine repeated question', () => {
  const tracker = createTracker({ externalShadowMs: 3000 });
  tracker.prime([]);
  tracker.markExternalFinal({
    id: 'voice-final-1',
    text: 'How would you prioritize this launch?',
    now: 1000
  });

  assert.deepEqual(tracker.update([
    message('dom-copy', 'user', 'How would you prioritize this launch?'),
    message('a-copy', 'assistant', 'First answer')
  ], 1500), []);

  const later = tracker.update([
    message('dom-repeat', 'user', 'How would you prioritize this launch?'),
    message('a-repeat', 'assistant', 'Second answer')
  ], 5000);
  assert.equal(later.length, 1);
});

test('external final shadow does not fuzzy-suppress short unrelated text', () => {
  const tracker = createTracker({ externalShadowMs: 8000 });
  tracker.prime([]);
  tracker.markExternalFinal({ id: 'voice-short', text: 'Okay now', now: 1000 });
  const emitted = tracker.update([
    message('dom-short', 'user', 'Okay now explain the product strategy'),
    message('a-short', 'assistant', 'Answer')
  ], 1500);
  assert.equal(emitted.length, 1);
});
