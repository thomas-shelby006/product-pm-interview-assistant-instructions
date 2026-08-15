import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyQuestionType,
  deriveAnswerAnalytics,
  summarizeAnswerAnalytics
} from '../shared/answer-quality-analytics.js';

test('question classifier maps common PM prompts to deterministic word bands', () => {
  assert.equal(classifyQuestionType('What is product-market fit?').type, 'simple_concept');
  assert.equal(classifyQuestionType('Compare RICE and MoSCoW and explain the tradeoffs.').type, 'comparison_tradeoff');
  assert.equal(classifyQuestionType('How would you launch this feature?').type, 'implementation');
  assert.equal(classifyQuestionType('How would you size the market for EV charging?').type, 'estimation');
  assert.equal(classifyQuestionType('Tell me about a time you handled a difficult stakeholder.').type, 'behavioral');
});

test('answer analytics records first-token latency generation pace speaking time and band fit', () => {
  const value = deriveAnswerAnalytics({
    questionText: 'What is product-market fit?', wordCount: 65,
    startedAt: 1000, firstTokenAt: 1300, completedAt: 31300,
    provider: 'chatgpt', role: 'receiver'
  });
  assert.equal(value.questionType, 'simple_concept');
  assert.equal(value.firstTokenLatencyMs, 300);
  assert.equal(value.generationMs, 30000);
  assert.equal(value.totalResponseMs, 30300);
  assert.equal(value.outputWpm, 130);
  assert.equal(value.bandFit, 'on_target');
  assert.equal(value.estimatedSpeakingMs, 30233);
  assert.equal(value.provider, 'chatgpt');
});
test('answer analytics distinguishes shallow and overlong responses without claiming semantic quality', () => {
  const shallow = deriveAnswerAnalytics({ questionText: 'How would you launch this feature?', wordCount: 70 });
  const long = deriveAnswerAnalytics({ questionText: 'What is product-market fit?', wordCount: 120 });
  assert.equal(shallow.bandFit, 'too_brief');
  assert.equal(long.bandFit, 'too_long');
  assert.equal(shallow.depthProxy, 'below_target_band');
  assert.equal(long.depthProxy, 'above_target_band');
});

test('session analytics summarize providers question types timing and word-band fit', () => {
  const summary = summarizeAnswerAnalytics([
    deriveAnswerAnalytics({ questionText: 'What is product-market fit?', wordCount: 65, startedAt: 0, firstTokenAt: 300, completedAt: 30300, provider: 'chatgpt', role: 'receiver' }),
    deriveAnswerAnalytics({ questionText: 'How would you launch this feature?', wordCount: 130, startedAt: 0, firstTokenAt: 500, completedAt: 60500, provider: 'claude', role: 'comparison' })
  ]);
  assert.equal(summary.totalAnswers, 2);
  assert.equal(summary.onTargetCount, 2);
  assert.equal(summary.providers.chatgpt.answerCount, 1);
  assert.equal(summary.providers.claude.answerCount, 1);
  assert.equal(summary.providers.chatgpt.averageFirstTokenMs, 300);
  assert.equal(summary.providers.chatgpt.averageGenerationMs, 30000);
  assert.equal(summary.providers.chatgpt.averageSpeakingMs, 30233);
  assert.equal(summary.providers.chatgpt.onTargetRatePct, 100);
  assert.equal(summary.providers.claude.averageOutputWpm, 130);
  assert.equal(summary.roles.receiver.answerCount, 1);
  assert.equal(summary.roles.comparison.answerCount, 1);
  assert.equal(summary.questionTypes.simple_concept.answerCount, 1);
  assert.equal(summary.questionTypes.simple_concept.targetMinWords, 55);
  assert.equal(summary.questionTypes.simple_concept.targetMaxWords, 75);
  assert.equal(summary.questionTypes.implementation.answerCount, 1);
  assert.equal(summary.questionTypes.implementation.questionTypeLabel, 'Implementation / how-would-you');
});


test('missing timing evidence does not count as zero-latency performance', () => {
  const summary = summarizeAnswerAnalytics([
    deriveAnswerAnalytics({ questionText: 'What is product-market fit?', wordCount: 65, startedAt: 1000, firstTokenAt: 1400, completedAt: 31400, provider: 'chatgpt', role: 'receiver' }),
    deriveAnswerAnalytics({ questionText: 'What is product-market fit?', wordCount: 70, provider: 'chatgpt', role: 'receiver' })
  ]);
  assert.equal(summary.averageFirstTokenMs, 400);
  assert.equal(summary.p95FirstTokenMs, 400);
  assert.equal(summary.providers.chatgpt.averageFirstTokenMs, 400);
  assert.equal(summary.providers.chatgpt.averageTotalResponseMs, 30400);
});

test('aggregate analytics preserve missing timing when no answer has timing evidence', () => {
  const summary = summarizeAnswerAnalytics([
    deriveAnswerAnalytics({ questionText: 'What is product-market fit?', wordCount: 65, provider: 'chatgpt', role: 'receiver' })
  ]);
  assert.equal(summary.averageFirstTokenMs, null);
  assert.equal(summary.p95FirstTokenMs, null);
  assert.equal(summary.averageGenerationMs, null);
  assert.equal(summary.averageTotalResponseMs, null);
  assert.equal(summary.averageOutputWpm, null);
  assert.equal(summary.providers.chatgpt.averageFirstTokenMs, null);
  assert.equal(summary.providers.chatgpt.averageTotalResponseMs, null);
});
