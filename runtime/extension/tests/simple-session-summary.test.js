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
  assert.deepEqual(value.receiver, { rendered:2, failed:0, averageMs:30, minMs:20, maxMs:40 });
  assert.deepEqual(value.comparison, { rendered:1, failed:1, averageMs:30, minMs:30, maxMs:30 });
  assert.equal('text' in value, false);
  assert.equal(JSON.stringify(value).includes('SECRET'), false);
});