import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAnswerStatus } from '../dashboard/answer-status-model.js';

test('idle answer state is independent from caught-up delivery', () => {
  const result = deriveAnswerStatus({ batchState: { active: null }, answerState: null, receiver: {} }, 1000);
  assert.deepEqual(result, {
    state: 'idle', label: 'Idle', title: 'No answer in progress', detail: 'Window 2 is ready for the next proven batch.', generating: false, confidence: 'high'
  });
});

test('waiting answer reports observation rather than generation', () => {
  const result = deriveAnswerStatus({
    batchState: { active: { batchId: 'b1', memberIds: ['q1'] } },
    answerState: { state: 'waiting', startedAt: 1000 },
    receiver: { generationState: { state: 'idle', generating: false, confidence: 'high', reason: 'no_generation_evidence' } }
  }, 4000);
  assert.equal(result.state, 'waiting');
  assert.equal(result.generating, false);
  assert.match(result.detail, /3s/);
});

test('streaming answer uses reconciled generation evidence', () => {
  const result = deriveAnswerStatus({
    batchState: { active: { batchId: 'b1' } },
    answerState: { state: 'streaming', wordCount: 12, lastEvidenceAt: 3000 },
    receiver: { generationState: { state: 'streaming', generating: true, confidence: 'medium', reason: 'assistant_text_growth' } }
  }, 4000);
  assert.equal(result.state, 'streaming');
  assert.equal(result.generating, true);
  assert.equal(result.confidence, 'medium');
  assert.match(result.detail, /12 words/);
});

test('terminal answer outcomes remain distinct after delivery proof', () => {
  for (const [state, label] of [['complete', 'Complete'], ['no_response', 'No response'], ['timed_out', 'Timed out'], ['cancelled', 'Cancelled']]) {
    const result = deriveAnswerStatus({ answerState: { state, reason: `${state}_reason` }, batchState: {} }, 5000);
    assert.equal(result.state, state);
    assert.equal(result.label, label);
  }
});

test('stale raw generating boolean cannot override reconciled idle evidence', () => {
  const result = deriveAnswerStatus({
    answerState: { state: 'waiting', startedAt: 1000 },
    receiver: { generating: true, generationState: { state: 'idle', generating: false, confidence: 'low', reason: 'stale_adapter_signal' } }
  }, 3000);
  assert.equal(result.generating, false);
  assert.equal(result.confidence, 'low');
});