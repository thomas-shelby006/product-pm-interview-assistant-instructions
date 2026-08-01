import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPersistence, createCoalescedCommitLane } from '../shared/persistence-urgency-policy.js';

test('persistence urgency keeps ownership proof and shutdown immediate', () => {
  for (const type of ['final_persisted', 'batch_proven', 'receiver_proof', 'session_end', 'storage_pressure']) {
    assert.equal(classifyPersistence({ type }), 'immediate');
  }
  for (const type of ['preview', 'next_batch_draft', 'batch_checkpoint', 'semantic_telemetry']) {
    assert.equal(classifyPersistence({ type }), 'coalesced');
  }
  assert.equal(classifyPersistence({ type: 'heartbeat' }), 'heartbeat');
});

test('coalesced lane keeps one timer per session and merges reasons', async () => {
  const timers = [];
  const commits = [];
  const lane = createCoalescedCommitLane({
    delayMs: 100,
    commit: async (sessionId, reasons) => commits.push({ sessionId, reasons }),
    setTimer(fn) { timers.push(fn); return timers.length; },
    clearTimer() {}
  });
  lane.schedule('s1', 'preview');
  lane.schedule('s1', 'batch_checkpoint');
  assert.equal(timers.length, 1);
  await timers[0]();
  assert.deepEqual(commits, [{ sessionId: 's1', reasons: ['batch_checkpoint', 'preview'] }]);
});

test('coalesced lane isolates sessions and flushes synchronously', async () => {
  const commits = [];
  const lane = createCoalescedCommitLane({
    commit: async (sessionId, reasons) => commits.push({ sessionId, reasons }),
    setTimer() { return 1; },
    clearTimer() {}
  });
  lane.schedule('s1', 'preview');
  lane.schedule('s2', 'semantic_telemetry');
  await lane.flush('s1');
  assert.deepEqual(commits, [{ sessionId: 's1', reasons: ['preview'] }]);
  assert.equal(lane.pending('s2'), true);
});

test('coalesced lane cancel removes pending work without commit', async () => {
  let committed = false;
  const lane = createCoalescedCommitLane({ commit: async () => { committed = true; }, setTimer() { return 1; }, clearTimer() {} });
  lane.schedule('s1', 'preview');
  assert.equal(lane.cancel('s1'), true);
  assert.equal(await lane.flush('s1'), false);
  assert.equal(committed, false);
});
