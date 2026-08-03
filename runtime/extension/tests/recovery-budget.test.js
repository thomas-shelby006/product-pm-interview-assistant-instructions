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

test('recovery budget bounds rapid manual-attempt storage without losing active automatic budget', () => {
  const budget = new RecoveryBudget({}, {
    maxAutomatic: 2,
    maxStoredAttempts: 5,
    windowMs: 10000,
    cooldownMs: 500
  });
  assert.equal(budget.consume({ source: 'automatic', now: 1 }).accepted, true);
  assert.equal(budget.consume({ source: 'automatic', now: 2 }).accepted, true);
  for (let at = 10; at < 20; at += 1) {
    assert.equal(budget.consume({ source: 'manual', now: at }).accepted, true);
  }
  const snapshot = budget.snapshot(20);
  assert.equal(snapshot.attempts.length, 5);
  assert.deepEqual(
    snapshot.attempts.filter(item => item.source === 'automatic').map(item => item.at),
    [1, 2]
  );
  assert.deepEqual(
    snapshot.attempts.filter(item => item.source === 'manual').map(item => item.at),
    [17, 18, 19]
  );
  assert.equal(snapshot.automaticUsed, 2);
  assert.equal(snapshot.state, 'exhausted');
});

test('recovery budget normalizes an oversized restored attempt list', () => {
  const attempts = [
    { at: 1, source: 'automatic' },
    { at: 2, source: 'automatic' },
    ...Array.from({ length: 10 }, (_, index) => ({ at: 10 + index, source: 'manual' }))
  ];
  const budget = new RecoveryBudget({ attempts }, {
    maxAutomatic: 2,
    maxStoredAttempts: 4,
    windowMs: 10000
  });
  assert.deepEqual(budget.snapshot(20).attempts, [
    { at: 1, source: 'automatic' },
    { at: 2, source: 'automatic' },
    { at: 18, source: 'manual' },
    { at: 19, source: 'manual' }
  ]);
});

test('recovery budget snapshots do not expose mutable attempt state', () => {
  const budget = new RecoveryBudget({}, { maxStoredAttempts: 4 });
  budget.consume({ source: 'manual', now: 10 });
  const first = budget.snapshot(11);
  first.attempts[0].source = 'automatic';
  first.attempts.push({ at: 12, source: 'manual' });
  assert.deepEqual(budget.snapshot(11).attempts, [{ at: 10, source: 'manual' }]);
});