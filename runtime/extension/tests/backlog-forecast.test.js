import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveBacklogForecast } from '../shared/backlog-forecast.js';

test('backlog forecast reports proof percentiles throughput and drain estimate', () => {
  const result = deriveBacklogForecast({ queued: 4, proofLatenciesMs: [1000, 2000, 3000, 4000], proofs: [{ at: 0 }, { at: 30000 }, { at: 60000 }] }, 60000);
  assert.equal(result.queued, 4);
  assert.equal(result.p50ProofMs, 2000);
  assert.equal(result.p95ProofMs, 4000);
  assert.ok(result.proofsPerMinute > 0);
  assert.ok(result.drainEstimateMs > 0);
});

test('forecast predicts at-risk backlog before target breach', () => {
  const result = deriveBacklogForecast({ queued: 10, oldestAgeMs: 15000, targetMs: 20000, proofLatenciesMs: [5000], proofs: [{ at: 0 }, { at: 60000 }] }, 60000);
  assert.ok(['at_risk', 'breached'].includes(result.risk));
  assert.equal('text' in result, false);
});