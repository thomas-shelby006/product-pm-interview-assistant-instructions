import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTransportLaneScore, chooseTransportLane } from '../shared/transport-lane-score.js';

test('lane score rewards low RTT and penalizes failures and open circuits', () => {
  assert.ok(deriveTransportLaneScore({ state: 'closed', lastRttMs: 20, consecutiveFailures: 0 }).score > 80);
  assert.ok(deriveTransportLaneScore({ state: 'open', lastRttMs: 1500, consecutiveFailures: 3 }).score < 20);
});

test('lane chooser prefers fallback only when direct evidence is degraded', () => {
  assert.equal(chooseTransportLane({ state: 'closed', lastRttMs: 30, consecutiveFailures: 0 }).mode, 'direct');
  assert.equal(chooseTransportLane({ state: 'open', lastRttMs: 900, consecutiveFailures: 2 }).mode, 'fallback');
});