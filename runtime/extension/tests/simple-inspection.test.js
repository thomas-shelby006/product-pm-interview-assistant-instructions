import test from 'node:test';
import assert from 'node:assert/strict';
import { answerMetrics, normalizeRecentQuestions } from '../simple/inspection.js';

test('answer metrics are deterministic and content-free', () => {
  assert.deepEqual(answerMetrics('', 129), { wordCount:0, estimatedSpeakingMs:0 });
  assert.deepEqual(answerMetrics('One two, three.', 120), { wordCount:3, estimatedSpeakingMs:1500 });
  assert.deepEqual(answerMetrics('one two three four', 60), { wordCount:4, estimatedSpeakingMs:4000 });
});

test('recent questions are capped and normalized only on explicit inspection', () => {
  const values = Array.from({ length:25 }, (_, index) => ({ id:`q${index}`, text:`Question ${index}` }));
  const recent = normalizeRecentQuestions(values, 20);
  assert.equal(recent.length, 20);
  assert.equal(recent[0].id, 'q5');
  assert.equal(recent.at(-1).text, 'Question 24');
});
