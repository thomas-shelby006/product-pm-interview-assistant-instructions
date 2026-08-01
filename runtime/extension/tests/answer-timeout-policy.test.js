import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAnswerDeadline } from '../content/answer-timeout-policy.js';

test('answer that never starts becomes no response after start grace', () => {
  const result = deriveAnswerDeadline({ state: 'waiting', startedAt: 1000, now: 9000 });
  assert.equal(result.terminal, true);
  assert.equal(result.state, 'no_response');
  assert.equal(result.reason, 'answer_never_started');
});

test('active text growth preserves streaming until the stall deadline', () => {
  const result = deriveAnswerDeadline({ state: 'streaming', startedAt: 1000, firstTokenAt: 2000, lastEvidenceAt: 7000, now: 10000 });
  assert.equal(result.terminal, false);
  assert.equal(result.state, 'streaming');
  assert.ok(result.deadlineAt > 10000);
});

test('stalled stream and hard cap have distinct reasons', () => {
  const stalled = deriveAnswerDeadline({ state: 'streaming', startedAt: 1000, firstTokenAt: 2000, lastEvidenceAt: 3000, now: 23000 });
  assert.equal(stalled.terminal, true);
  assert.equal(stalled.reason, 'answer_stream_stalled');
  const capped = deriveAnswerDeadline({ state: 'streaming', startedAt: 1000, firstTokenAt: 2000, lastEvidenceAt: 120000, now: 121000 });
  assert.equal(capped.terminal, true);
  assert.equal(capped.reason, 'answer_hard_timeout');
});

test('configured limits are respected exactly', () => {
  const result = deriveAnswerDeadline({ state: 'waiting', startedAt: 0, now: 500, limits: { startGraceMs: 500, streamStallMs: 700, hardCapMs: 900 } });
  assert.equal(result.state, 'no_response');
});