import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveLiveAnswerAnalytics } from '../dashboard/live-answer-analytics-model.js';

test('live analytics compare primary and optional comparison receiver without answer text', () => {
  const model = deriveLiveAnswerAnalytics({
    receiver:{ provider:'chatgpt', latestAnswer:{ text:'private', analytics:{ questionType:'implementation', wordCount:132, bandFit:'on_target', firstTokenLatencyMs:420, totalResponseMs:61200, outputWpm:130, estimatedSpeakingMs:61395 } } },
    comparison:{ connected:true, provider:'claude', latestAnswer:{ text:'private 2', analytics:{ questionType:'implementation', wordCount:118, bandFit:'on_target', firstTokenLatencyMs:510, totalResponseMs:55900, outputWpm:128, estimatedSpeakingMs:54884 } } },
    batchState:{ autoSubmit:false, next:{ entries:[{},{}] } }
  });
  assert.equal(model.primary.provider, 'chatgpt');
  assert.equal(model.primary.firstTokenMs, 420);
  assert.equal(model.comparison.provider, 'claude');
  assert.equal(model.comparison.wordCount, 118);
  assert.equal(model.forwardingMode, 'manual_gather');
  assert.equal(model.waitingCount, 2);
  assert.equal(JSON.stringify(model).includes('private'), false);
});

test('live analytics handles production sessions without comparison', () => {
  const model = deriveLiveAnswerAnalytics({ receiver:{ provider:'chatgpt' }, batchState:{ autoSubmit:true } });
  assert.equal(model.comparison.enabled, false);
  assert.equal(model.forwardingMode, 'automatic');
});

test('live analytics distinguish missing timing evidence from observed zero latency', () => {
  const model = deriveLiveAnswerAnalytics({
    receiver:{ provider:'chatgpt', latestAnswer:{ wordCount:68, analytics:{ questionType:'simple_concept', wordCount:68, bandFit:'on_target' } } },
    batchState:{ autoSubmit:true }
  });
  assert.equal(model.primary.firstTokenMs, null);
  assert.equal(model.primary.totalResponseMs, null);
  assert.equal(model.primary.outputWpm, null);
});
