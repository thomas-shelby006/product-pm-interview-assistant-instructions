import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveBatchSchedulingDecision } from '../shared/batch-scheduling-policy.js';

test('scheduling policy escalates age without reordering member ids', () => {
  const decision = deriveBatchSchedulingDecision({ memberIds: ['q1', 'q2'], oldestAt: 1000, now: 70000 });
  assert.equal(decision.urgency, 'critical');
  assert.deepEqual(decision.memberIds, ['q1', 'q2']);
  assert.equal(decision.submitRecommended, true);
});

test('explicit hold remains authoritative even when overdue', () => {
  const decision = deriveBatchSchedulingDecision({ memberIds: ['q1'], oldestAt: 1, now: 100000, hold: true });
  assert.equal(decision.submitRecommended, false);
  assert.equal(decision.reason, 'operator_hold');
});