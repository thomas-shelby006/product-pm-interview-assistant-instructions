import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTransportLanes } from '../dashboard/transport-lane-model.js';

test('transport lane model reports direct fallback and open circuit states', () => {
  const value = deriveTransportLanes({
    sender: { transportLane: { state: 'closed', lastRttMs: 21, lastMode: 'direct' } },
    receiver: { transportLane: { state: 'open', lastRttMs: 0, lastMode: 'fallback', nextProbeAt: 5000, lastFailureReason: 'port_request_timeout' } }
  }, 3000);
  assert.equal(value.sender.label, 'Direct preferred');
  assert.equal(value.receiver.label, 'Open circuit');
  assert.equal(value.receiver.retryInMs, 2000);
});
