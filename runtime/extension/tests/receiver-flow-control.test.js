import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveReceiverCredits } from '../shared/receiver-flow-control.js';

test('receiver credits reach zero before sequence buffer overflow and recover after drain', () => {
  const full = deriveReceiverCredits({ bufferedCount: 8, maxBuffered: 8, activeMembers: 1, hold: false });
  assert.equal(full.available, 0);
  assert.equal(full.state, 'backpressure');
  const recovered = deriveReceiverCredits({ bufferedCount: 2, maxBuffered: 8, activeMembers: 0, hold: false });
  assert.equal(recovered.available, 6);
  assert.equal(recovered.canAccept, true);
});

test('receiver hold and storage critical force zero credits with reason codes', () => {
  assert.equal(deriveReceiverCredits({ hold: true }).reason, 'operator_hold');
  assert.equal(deriveReceiverCredits({ storageCritical: true }).reason, 'storage_critical');
});