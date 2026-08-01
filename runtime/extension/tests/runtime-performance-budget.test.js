import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimePerformanceBudget } from '../shared/runtime-performance-budget.js';

test('performance budget accepts bounded operations for a ten-thousand-entry ledger', () => {
  const budget = new RuntimePerformanceBudget();
  budget.record({ kind: 'ledger_lookup', operations: 30000, budget: 40000, entries: 10000 });
  const snapshot = budget.snapshot();
  assert.equal(snapshot.state, 'healthy');
  assert.equal(snapshot.operations.ledger_lookup, 30000);
  assert.deepEqual(snapshot.violations, []);
});

test('performance budget records deterministic violations without wall-clock timing', () => {
  const budget = new RuntimePerformanceBudget();
  budget.record({ kind: 'ledger_lookup', operations: 50001, budget: 40000, entries: 10000 });
  const snapshot = budget.snapshot();
  assert.equal(snapshot.state, 'violated');
  assert.equal(snapshot.violations[0].kind, 'ledger_lookup');
  assert.equal(snapshot.violations[0].excess, 10001);
});

test('performance budget aggregates bytes cache hits and commit reasons', () => {
  const budget = new RuntimePerformanceBudget();
  budget.record({ kind: 'snapshot_sections', operations: 4, cacheHits: 8, cacheMisses: 2, bytes: 1200 });
  budget.record({ kind: 'persistence', operations: 1, bytes: 800, reason: 'batch_proven' });
  const snapshot = budget.snapshot();
  assert.equal(snapshot.payloadBytes, 2000);
  assert.equal(snapshot.cacheHitRate, 80);
  assert.equal(snapshot.commitReasons.batch_proven, 1);
});

test('performance budget restores bounded prior state and remains clone safe', () => {
  const original = new RuntimePerformanceBudget();
  original.record({ kind: 'timeline_scan', operations: 200, budget: 200 });
  const restored = new RuntimePerformanceBudget(original.exportState());
  const first = restored.snapshot();
  first.operations.timeline_scan = 999;
  assert.equal(restored.snapshot().operations.timeline_scan, 200);
});
