import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveOutboxStatus } from '../dashboard/outbox-status-model.js';

test('outbox status reports retained finals and retry delay', () => {
  const value = deriveOutboxStatus({ timeline: [{
    type: 'outbox_state', at: 1000,
    data: { count: 2, attempts: 3, nextRetryAt: 5000, lastError: 'offline' }
  }] }, 3000);
  assert.equal(value.state, 'waiting');
  assert.equal(value.count, 2);
  assert.equal(value.retryInMs, 2000);
});

test('outbox status is clear when no sender finals remain', () => {
  assert.equal(deriveOutboxStatus({ timeline: [] }).state, 'clear');
});
