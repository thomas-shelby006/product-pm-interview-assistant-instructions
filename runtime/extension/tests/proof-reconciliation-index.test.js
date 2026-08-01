import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRenderedProofIndex } from '../shared/proof-reconciliation-index.js';

function prompt(text, memberIds = ['q1']) {
  return { text, memberIds, questionCount: memberIds.length, fingerprint: 'f', memberFingerprint: 'm' };
}

test('rendered proof index matches exact and normalized frozen prompts', () => {
  const index = buildRenderedProofIndex([
    { role: 'assistant', text: 'ignore' },
    { role: 'user', text: '  What   is the north-star metric?  ' }
  ]);
  assert.equal(index.matches(prompt('What is the north-star metric?')), true);
  assert.equal(index.size, 1);
  assert.equal(index.stats().messagesIndexed, 1);
});

test('rendered proof index finds a frozen prompt inside provider wrapper text', () => {
  const text = 'MULTIPLE INTERVIEWER QUESTIONS WERE RECEIVED WHILE THE PREVIOUS ANSWER WAS IN PROGRESS.\nLATEST QUESTION: Activation?';
  const index = buildRenderedProofIndex([{ role: 'user', text: `Provider prefix ${text} Provider suffix` }]);
  assert.equal(index.matches(prompt(text, ['q1', 'q2'])), true);
});

test('rendered proof index rejects fingerprint collisions after exact verification', () => {
  const index = buildRenderedProofIndex([{ role: 'user', text: 'Unrelated question' }], { fingerprintFn: () => 'same' });
  assert.equal(index.matches(prompt('Different question'), { fingerprintFn: () => 'same' }), false);
});

test('rendered proof index is built once and reused across batch checks', () => {
  const index = buildRenderedProofIndex([
    { role: 'user', text: 'Question one' },
    { role: 'user', text: 'Question two' }
  ]);
  index.matches(prompt('Question one'));
  index.matches(prompt('Question two'));
  assert.equal(index.stats().buildPasses, 1);
  assert.equal(index.stats().queries, 2);
});
