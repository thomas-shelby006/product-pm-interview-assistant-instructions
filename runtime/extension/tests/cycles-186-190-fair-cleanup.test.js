import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleFairBatch } from '../shared/fair-batch-scheduler.js';
import { promoteStarvedPartitions, starvationSummary } from '../shared/starvation-promotion.js';
import { auditSessionIsolation } from '../shared/session-isolation-audit.js';
import { beginCleanupTransaction, recordCleanupStep, resumeCleanupTransaction } from '../shared/cleanup-transaction-journal.js';
import { collectOrphanManagedWindows } from '../shared/orphan-window-collector.js';

test('Cycle 186: fair scheduler prevents one source from monopolizing batches', () => {
  const result = scheduleFairBatch([{ id: 'a', source: 'chatgpt', consecutive: 2, oldestAt: 1, firstSeq: 1 }, { id: 'b', source: 'manual', consecutive: 0, oldestAt: 2, firstSeq: 2 }], { lastSource: 'chatgpt', maxConsecutive: 2, now: 10 });
  assert.equal(result.selected.id, 'b');
});

test('Cycle 187: starvation promotion moves overdue batches ahead without changing internal sequence', () => {
  const promoted = promoteStarvedPartitions([{ id: 'new', oldestAt: 90, firstSeq: 2 }, { id: 'old', oldestAt: 0, firstSeq: 1 }], { now: 200, thresholdMs: 100 });
  assert.equal(promoted[0].id, 'old'); assert.equal(promoted[0].promoted, true);
  assert.deepEqual(starvationSummary(promoted, { now: 200, thresholdMs: 100 }).order[0], 'old');
});

test('Cycle 188: session isolation detects shared tabs and runtime instances', () => {
  const result = auditSessionIsolation([{ sessionId: 'a', sender: { tabId: 1, instanceId: 'x' } }, { sessionId: 'b', receiver: { tabId: 1, instanceId: 'x' } }]);
  assert.equal(result.ok, false); assert.equal(result.issues.length, 2);
});

test('Cycle 188b: session isolation includes the optional comparison role', () => {
  const result = auditSessionIsolation([
    { sessionId: 'a', comparison: { tabId: 9, instanceId: 'cmp-shared' } },
    { sessionId: 'b', receiver: { tabId: 9, instanceId: 'cmp-shared' } }
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.issues.length, 2);
  assert.equal(result.tabCount, 1);
  assert.equal(result.runtimeCount, 1);
});
test('Cycle 190b: orphan collection recognizes comparison windows and preserves owned comparison windows', () => {
  const result = collectOrphanManagedWindows({ now: 1000, staleAfterMs: 100, sessions: [
    { sessionId: 's1', comparison: { windowId: 4 } }
  ], windows: [
    { id: 4, title: 'PMIA_COMPARISON_CLAUDE_S1', lastSeenAt: 0 },
    { id: 5, title: 'PMIA_COMPARISON_CHATGPT_OLD', lastSeenAt: 0 }
  ] });
  assert.deepEqual(result.orphans.map(item => item.windowId), [5]);
});
test('Cycle 189: cleanup transaction is resumable after a failed step', () => {
  let transaction = beginCleanupTransaction({ sessionId: 's1', now: 10, id: 'c' });
  transaction = recordCleanupStep(transaction, 'freeze_commands', { ok: true }, 20).transaction;
  transaction = recordCleanupStep(transaction, 'clear_registry', { ok: false, error: 'storage_failed' }, 30).transaction;
  const resume = resumeCleanupTransaction(transaction);
  assert.equal(resume.resumable, true);
  assert.equal(resume.nextStep, 'export_optional');
});

test('Cycle 190: orphan collector targets only stale unowned PMIA windows', () => {
  const result = collectOrphanManagedWindows({ now: 1000, staleAfterMs: 100, sessions: [{ sessionId: 's1', sender: { windowId: 1 } }], windows: [
    { id: 1, title: 'PMIA_SENDER_CHATGPT_S1', lastSeenAt: 0 },
    { id: 2, title: 'PMIA_RECEIVER_CHATGPT_OLD', lastSeenAt: 0 },
    { id: 3, title: 'Unrelated browser', lastSeenAt: 0 }
  ] });
  assert.deepEqual(result.orphans.map(item => item.windowId), [2]);
});
