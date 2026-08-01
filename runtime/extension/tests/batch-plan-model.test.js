import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveBatchPlan } from '../dashboard/batch-plan-model.js';

test('batch plan model exposes protected questions and sequential batch count', () => {
  const plan = deriveBatchPlan({ batchState: { next: { questionCount: 3, protectedCount: 11, partitionCount: 4, remainingCount: 8 } } });
  assert.equal(plan.protectedCount, 11);
  assert.equal(plan.partitionCount, 4);
  assert.equal(plan.currentCount, 3);
  assert.equal(plan.remainingCount, 8);
});
