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
