import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRenderedTurnIdentity, sameRenderedTurn } from '../shared/rendered-turn-identity.js';
import { buildPartialProofReport, mergePartialProofReports } from '../shared/partial-proof-report.js';
import { deriveProofRetryPolicy, resetProofRetry } from '../shared/proof-retry-policy.js';
import { createDurableTombstone, mergeDurableTombstones, tombstoneMatches } from '../shared/durable-tombstones.js';
import { deriveCompactionHorizon } from '../shared/compaction-horizon.js';

test('Cycle 181: rendered turn identity survives replacement IDs only when structural and text identity match', () => {
  const first = canonicalRenderedTurnIdentity({ provider: 'chatgpt', role: 'user', text: 'Hello', previousRole: 'assistant', nextRole: 'assistant', ordinal: 3 });
  const second = canonicalRenderedTurnIdentity({ provider: 'chatgpt', role: 'user', text: 'Hello', previousRole: 'assistant', nextRole: 'assistant', ordinal: 3 });
  assert.equal(sameRenderedTurn(first, second), true);
});

test('Cycle 182: partial proof reports exact proven missing and mismatched members', () => {
  const report = buildPartialProofReport({ batchId: 'b', expectedIds: ['q1','q2','q3'], provenIds: ['q1'], mismatchedIds: ['x'] });
  assert.deepEqual(report.missingIds, ['q2','q3']); assert.equal(report.complete, false);
  const merged = mergePartialProofReports(report, { batchId: 'b', expectedIds: ['q1','q2','q3'], provenIds: ['q2','q3'], observedAt: 20 });
  assert.deepEqual(merged.provenIds.sort(), ['q1','q2','q3']);
});

test('Cycle 183: proof retry is bounded exponential and stops on missing render', () => {
  assert.equal(deriveProofRetryPolicy({ attempt: 0, now: 100 }).dueAt, 250);
  assert.equal(deriveProofRetryPolicy({ attempt: 4 }).terminal, true);
  assert.equal(deriveProofRetryPolicy({ batchStillRendered: false }).reason, 'rendered_batch_missing');
  assert.equal(resetProofRetry().attempt, 0);
});

test('Cycle 184: durable tombstones suppress replay after proven entries are compacted', () => {
  const entry = { id: 'q1', state: 'proven', batchId: 'b1', envelope: { id: 'q1', seq: 1, sourceProvider: 'chatgpt' }, proof: { proofId: 'p1' } };
  const stone = createDurableTombstone(entry, 10);
  const merged = mergeDurableTombstones([], [entry]);
  assert.equal(stone.proofId, 'p1');
  assert.equal(tombstoneMatches(merged, entry.envelope).id, 'q1');
});

test('Cycle 185: compaction horizon includes only old proven or archived entries', () => {
  const entries = [
    { id: 'old', state: 'proven', updatedAt: 1 },
    { id: 'pending', state: 'persisted', updatedAt: 1 },
    { id: 'recent', state: 'proven', updatedAt: 999 }
  ];
  const result = deriveCompactionHorizon(entries, { now: 1000, retainMs: 500, retainProven: 1 });
  assert.deepEqual(result.compactableIds, ['old']);
  assert.equal(result.protectedCount, 1);
  assert.equal(result.safe, true);
});
