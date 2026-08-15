import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roleLogKey,
  appendBoundedLog,
  renderSessionMarkdown,
  buildSessionExport,
  summarizeSessionEvents
} from '../shared/session-log.js';

test('role log keys separate sender and receiver records', () => {
  assert.equal(roleLogKey('session-1', 'sender'), 'pmia_log_session-1_sender');
  assert.equal(roleLogKey('session-1', 'receiver'), 'pmia_log_session-1_receiver');
  assert.throws(() => roleLogKey('session-1', 'other'));
});

test('bounded log retains a truncation marker and newest events', () => {
  const original = [
    { type: 'one' },
    { type: 'two' },
    { type: 'three' }
  ];
  const next = appendBoundedLog(original, { type: 'four' }, 3, '2026-07-28T00:00:00Z');
  assert.equal(next.length, 3);
  assert.deepEqual(next[0], {
    type: 'log_truncated',
    droppedCount: 2,
    recordedAt: '2026-07-28T00:00:00Z'
  });
  assert.deepEqual(next.slice(1).map(event => event.type), ['three', 'four']);
});

test('bounded log accumulates prior dropped count without duplicate markers', () => {
  const original = [
    { type: 'log_truncated', droppedCount: 4, recordedAt: 'old' },
    { type: 'three' },
    { type: 'four' }
  ];
  const next = appendBoundedLog(original, { type: 'five' }, 3, 'new');
  assert.equal(next.filter(event => event.type === 'log_truncated').length, 1);
  assert.equal(next[0].droppedCount, 5);
  assert.deepEqual(next.slice(1).map(event => event.type), ['four', 'five']);
});

test('Markdown export uses valid UTF-8 punctuation and redacted text', () => {
  const markdown = renderSessionMarkdown({
    session: { sessionId: 's1', role: 'sender', provider: 'claude' },
    events: [{ recordedAt: '2026-07-28T00:00:00Z', type: 'sender_text', text: 'Question?' }]
  });
  assert.match(markdown, /2026-07-28T00:00:00Z — sender_text/);
  assert.doesNotMatch(markdown, /â€”/);
  assert.match(markdown, /Window: sender \/ claude/);
});

test('session export includes safe context and derived mock-review summary', () => {
  const events = [
    { type: 'session_armed', sessionContext: { company: 'Acme', answerMode: 'concise' } },
    { type: 'received_text', kind: 'question', deliveryElapsedMs: 40 },
    { type: 'answer', text: 'A concise answer', wordCount: 3 }
  ];
  const payload = buildSessionExport({
    session: { sessionId: 's1', role: 'receiver', provider: 'chatgpt' },
    events,
    exportedAt: '2026-07-28T01:00:00Z'
  });
  assert.equal(payload.schemaVersion, '2.2');
  assert.deepEqual(payload.sessionContext, { company: 'Acme', answerMode: 'concise' });
  assert.equal(payload.summary.sessionArmed, true);
  assert.equal(payload.summary.questionCount, 1);
  assert.equal(payload.summary.answerCount, 1);
  assert.equal(payload.summary.averageAnswerWords, 3);
  assert.equal(payload.summary.averageDeliveryMs, 40);
  assert.deepEqual(payload.events, events);
});

test('session summary highlights long answers, queueing, duplicates, and timeouts', () => {
  const summary = summarizeSessionEvents([
    { type: 'answer', wordCount: 181 },
    { type: 'answer', wordCount: 99 },
    { type: 'forward', queued: true },
    { type: 'delivery_ignored' },
    { type: 'answer_timeout' }
  ]);
  assert.equal(summary.averageAnswerWords, 140);
  assert.equal(summary.maxAnswerWords, 181);
  assert.equal(summary.answersOver180, 1);
  assert.equal(summary.queuedFinalCount, 1);
  assert.equal(summary.ignoredDeliveryCount, 1);
  assert.equal(summary.answerTimeoutCount, 1);
});
test('sender boot forwarding counts as an armed session summary', () => {
  const summary = summarizeSessionEvents([
    { type: 'sender_text', kind: 'boot', delivered: true }
  ]);
  assert.equal(summary.sessionArmed, true);
});

test('session export includes post-interview response analytics by provider and question type', () => {
  const events = [
    { type:'answer', role:'receiver', provider:'chatgpt', wordCount:65, analytics:{ provider:'chatgpt', role:'receiver', questionType:'simple_concept', wordCount:65, bandFit:'on_target', firstTokenLatencyMs:300, totalResponseMs:30300, outputWpm:130 } },
    { type:'answer', role:'comparison', provider:'claude', wordCount:130, analytics:{ provider:'claude', role:'comparison', questionType:'implementation', wordCount:130, bandFit:'on_target', firstTokenLatencyMs:500, totalResponseMs:60500, outputWpm:130 } }
  ];
  const payload = buildSessionExport({ session:{ sessionId:'s-compare', role:'receiver', provider:'chatgpt' }, events, exportedAt:'2026-08-15T06:00:00Z' });
  assert.equal(payload.schemaVersion, '2.2');
  assert.equal(payload.answerAnalytics.totalAnswers, 2);
  assert.equal(payload.answerAnalytics.providers.chatgpt.averageFirstTokenMs, 300);
  assert.equal(payload.answerAnalytics.providers.claude.averageFirstTokenMs, 500);
  assert.equal(payload.answerAnalytics.questionTypes.simple_concept.onTargetCount, 1);
  const markdown = renderSessionMarkdown({ ...payload });
  assert.match(markdown, /## Response analytics/);
  assert.match(markdown, /Chatgpt: 1 answers/);
  assert.match(markdown, /Claude: 1 answers/);
  assert.match(markdown, /first token 300 ms/);
});

test('combined session analysis compares all active answer agents without transcript content', async () => {
  const { buildCombinedSessionAnalysis } = await import('../shared/session-log.js');
  const analysis = buildCombinedSessionAnalysis({
    sender:[{ type:'forward', deliveryProofMs:20 }],
    receiver:[{ type:'answer', text:'private primary answer', analytics:{ provider:'chatgpt', role:'receiver', questionType:'simple_concept', wordCount:65, bandFit:'on_target', firstTokenLatencyMs:300, totalResponseMs:30300, outputWpm:130 } }],
    comparison:[{ type:'answer', text:'private comparison answer', analytics:{ provider:'claude', role:'comparison', questionType:'simple_concept', wordCount:72, bandFit:'on_target', firstTokenLatencyMs:450, totalResponseMs:33400, outputWpm:131 } }]
  }, { sessionId:'s1', generatedAt:'2026-08-15T06:30:00Z' });
  assert.equal(analysis.schemaVersion, '1.0');
  assert.equal(analysis.roles.comparison.answerCount, 1);
  assert.equal(analysis.answerAnalytics.providers.chatgpt.averageFirstTokenMs, 300);
  assert.equal(analysis.answerAnalytics.providers.claude.averageFirstTokenMs, 450);
  assert.equal(JSON.stringify(analysis).includes('private primary answer'), false);
  assert.equal(JSON.stringify(analysis).includes('private comparison answer'), false);
});

test('session Markdown reports missing timing as pending instead of zero-latency performance', async () => {
  const { summarizeAnswerAnalytics } = await import('../shared/answer-quality-analytics.js');
  const answerAnalytics = summarizeAnswerAnalytics([
    { provider:'chatgpt', role:'receiver', questionType:'simple_concept', questionTypeLabel:'Simple conceptual PM answer', targetMinWords:55, targetMaxWords:75, wordCount:65, bandFit:'on_target', firstTokenLatencyMs:null, generationMs:null, totalResponseMs:null, outputWpm:null, estimatedSpeakingMs:30233 }
  ]);
  const markdown = renderSessionMarkdown({ session:{ sessionId:'s1', role:'receiver', provider:'chatgpt' }, events:[], summary:{}, sessionContext:{}, answerAnalytics });
  assert.match(markdown, /Average first token: pending/);
  assert.match(markdown, /first token pending/);
  assert.doesNotMatch(markdown, /first token 0 ms/);
});
