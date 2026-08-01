import test from 'node:test';
import assert from 'node:assert/strict';
import { RecoveryBudget } from '../shared/recovery-budget.js';

test('recovery budget exhausts automatic repairs inside the rolling window', () => {
  const budget = new RecoveryBudget({}, { maxAutomatic: 2, windowMs: 1000, cooldownMs: 500 });
  assert.equal(budget.consume({ source: 'automatic', now: 10 }).accepted, true);
  assert.equal(budget.consume({ source: 'automatic', now: 20 }).accepted, true);
  const blocked = budget.consume({ source: 'automatic', now: 30 });
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.state, 'exhausted');
});

test('manual repair remains explicit and reset clears exhaustion', () => {
  const budget = new RecoveryBudget({ attempts: [{ at: 10, source: 'automatic' }] }, { maxAutomatic: 1, windowMs: 1000 });
  assert.equal(budget.consume({ source: 'manual', now: 20 }).accepted, true);
  assert.equal(budget.consume({ source: 'automatic', now: 30 }).accepted, false);
  budget.reset(40);
  assert.equal(budget.consume({ source: 'automatic', now: 50 }).accepted, true);
});