import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompactionPlan, estimateStorageCategories, utf8Bytes } from '../shared/storage-accounting.js';

test('storage accounting separates actionable text from proven and telemetry', () => {
  const categories = estimateStorageCategories([{ sessionId: 's1', ledger: [
    { id: 'q1', state: 'persisted', envelope: { text: 'keep me' } },
    { id: 'q2', state: 'proven', envelope: { text: 'compact me' } }
  ], timeline: [{ type: 'heartbeat' }], metrics: {}, processedCommandIds: [] }]);
  assert.ok(categories.actionable > 0);
  assert.ok(categories.proven > 0);
  assert.ok(categories.telemetry > 0);
  assert.equal(categories.total, categories.actionable + categories.proven + categories.telemetry + categories.snapshots);
});

test('compaction plan never selects actionable storage', () => {
  const result = buildCompactionPlan({ total: 1000, actionable: 700, telemetry: 100, snapshots: 50, proven: 150 }, 700);
  assert.deepEqual(result.plan.map(item => item.category), ['telemetry', 'snapshots', 'proven']);
  assert.equal(result.actionableProtected, true);
  assert.equal(result.remainingBytes, 0);
});

test('utf8 byte estimation handles non-ascii text', () => {
  assert.equal(utf8Bytes('A'), 1);
  assert.equal(utf8Bytes('\u20B9'), 3);
});
