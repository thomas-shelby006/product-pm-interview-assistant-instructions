import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnswerLifecycle } from '../content/answer-lifecycle.js';

test('answer lifecycle separates waiting streaming and complete', () => {
  const lifecycle = createAnswerLifecycle();
  assert.equal(lifecycle.transition({ type: 'start', batchId: 'b1', at: 100 }).state, 'waiting');
  assert.equal(lifecycle.transition({ type: 'stream', at: 150, wordCount: 3 }).state, 'streaming');
  const complete = lifecycle.transition({ type: 'complete', at: 250, wordCount: 12 });
  assert.equal(complete.state, 'complete');
  assert.equal(complete.elapsedMs, 150);
  assert.equal(complete.wordCount, 12);
});

test('no response timeout and cancellation are distinct terminal states', () => {
  for (const [type, state] of [['no_response', 'no_response'], ['timeout', 'timed_out'], ['cancel', 'cancelled']]) {
    const lifecycle = createAnswerLifecycle();
    lifecycle.transition({ type: 'start', batchId: 'b1', at: 100 });
    assert.equal(lifecycle.transition({ type, at: 200, reason: type }).state, state);
  }
});

test('terminal answer state is idempotent', () => {
  const lifecycle = createAnswerLifecycle();
  lifecycle.transition({ type: 'start', batchId: 'b1', at: 100 });
  const first = lifecycle.transition({ type: 'no_response', at: 200, reason: 'never_started' });
  const second = lifecycle.transition({ type: 'complete', at: 300, wordCount: 20 });
  assert.deepEqual(second, first);
});

test('answer lifecycle snapshots contain no answer text', () => {
  const lifecycle = createAnswerLifecycle();
  lifecycle.transition({ type: 'start', batchId: 'b1', at: 100 });
  lifecycle.transition({ type: 'stream', at: 120, wordCount: 4, text: 'secret' });
  assert.doesNotMatch(JSON.stringify(lifecycle.snapshot()), /secret/);
});