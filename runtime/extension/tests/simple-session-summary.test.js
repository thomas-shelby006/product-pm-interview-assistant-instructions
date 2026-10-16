import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/session-summary.js').catch(() => null);

test('session summary derives delivery metrics without transcript text', () => {
  assert.ok(mod);
  const snapshot = {
    sessionId:'s1', roles:{ sender:true, receiver:true, comparison:true },
    stages:[
      { ts:1, role:'sender', turnId:'t1', stage:'captured' },
      { ts:2, role:'receiver', turnId:'t1', stage:'rendered', elapsedMs:20 },
      { ts:3, role:'comparison', turnId:'t1', stage:'rendered', elapsedMs:30 },
      { ts:4, role:'sender', turnId:'t2', stage:'captured' },
      { ts:5, role:'receiver', turnId:'t2', stage:'rendered', elapsedMs:40 },
      { ts:6, role:'comparison', turnId:'t2', stage:'failed', elapsedMs:10, reason:'submit_failed' }
    ]
  };
  const value = mod.buildSessionSummary(snapshot);
  assert.equal(value.questionsCaptured, 2);
  assert.deepEqual(value.receiver, { rendered:2, failed:0, averageMs:30, minMs:20, maxMs:40, successRate:1 });
  assert.deepEqual(value.comparison, { rendered:1, failed:1, averageMs:30, minMs:30, maxMs:30, successRate:0.5 });
  assert.deepEqual(value.markers, { strong_answer:0, needs_review:0, follow_up:0 });
  assert.equal('text' in value, false);
  assert.equal(JSON.stringify(value).includes('SECRET'), false);
});

test('session summary includes metadata-only review marker counts and success rates', () => {
  const snapshot = {
    sessionId:'s1', stages:[
      { role:'sender', turnId:'t1', stage:'captured' },
      { role:'receiver', turnId:'t1', stage:'rendered', elapsedMs:20 },
      { role:'comparison', turnId:'t1', stage:'failed', reason:'submit_failed' }
    ]
  };
  const markers = [
    { sessionId:'s1', turnId:'t1', category:'needs_review', at:1 },
    { sessionId:'s1', turnId:'t2', category:'follow_up', at:2 }
  ];
  const value = mod.buildSessionSummary(snapshot, markers);
  assert.equal(value.receiver.successRate, 1);
  assert.equal(value.comparison.successRate, 0);
  assert.deepEqual(value.markers, { strong_answer:0, needs_review:1, follow_up:1 });
});
