import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDuePartition } from '../shared/delivery-deadline-queue.js';

function partition(index, memberIds, oldestAt, firstSeq) {
  return { index, memberIds, oldestAt, firstSeq };
}

test('deadline queue selects the oldest due partition without reordering members', () => {
  const result = selectDuePartition([
    partition(0, ['q1', 'q2'], 1000, 1),
    partition(1, ['q3', 'q4'], 5000, 3)
  ], { now: 25000 });
  assert.equal(result.selected.index, 0);
  assert.deepEqual(result.selected.memberIds, ['q1', 'q2']);
  assert.equal(result.submitRecommended, true);
  assert.equal(result.urgency, 'elevated');
});

test('deadline queue breaks equal deadlines by first sequence then source index', () => {
  const result = selectDuePartition([
    partition(2, ['q5'], 1000, 5),
    partition(1, ['q3'], 1000, 3),
    partition(0, ['q1'], 1000, 1)
  ], { now: 25000 });
  assert.equal(result.selected.firstSeq, 1);
  assert.equal(result.selected.index, 0);
});

test('explicit hold remains authoritative over an overdue deadline', () => {
  const result = selectDuePartition([partition(0, ['q1'], 1, 1)], { now: 100000, hold: true });
  assert.equal(result.selected, null);
  assert.equal(result.reason, 'operator_hold');
  assert.equal(result.submitRecommended, false);
});

test('active answer suppresses deadline submission without deleting the partition', () => {
  const source = partition(0, ['q1'], 1, 1);
  const result = selectDuePartition([source], { now: 100000, active: true });
  assert.equal(result.selected, null);
  assert.equal(result.reason, 'active_answer');
  assert.deepEqual(result.waiting.map(item => item.memberIds), [['q1']]);
  assert.deepEqual(source, partition(0, ['q1'], 1, 1));
});

test('auto-submit and draft conflict remain explicit blockers', () => {
  const source = [partition(0, ['q1'], 1, 1)];
  assert.equal(selectDuePartition(source, { now: 100000, autoSubmit: false }).reason, 'auto_submit_disabled');
  assert.equal(selectDuePartition(source, { now: 100000, draftConflict: true }).reason, 'draft_conflict');
});
