import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireAttemptLease, releaseAttemptLease, isAttemptLeaseActive } from '../shared/delivery-attempt-lease.js';
import { DeliveryLedger } from '../shared/delivery-ledger.js';

const envelope = id => ({ id, sessionId: 's1', sourceProvider: 'chatgpt', kind: 'question', seq: 1, text: 'Question', metadata: {}, createdAt: 1 });

test('attempt lease blocks concurrent owner until expiry and permits reason-coded takeover', () => {
  const first = acquireAttemptLease(null, { owner: 'automatic', now: 10, ttlMs: 50 });
  assert.equal(first.accepted, true);
  assert.equal(acquireAttemptLease(first.lease, { owner: 'repair', now: 20 }).reason, 'attempt_lease_held');
  const takeover = acquireAttemptLease(first.lease, { owner: 'repair', now: 61, ttlMs: 40 });
  assert.equal(takeover.accepted, true);
  assert.equal(takeover.reason, 'attempt_lease_takeover');
  assert.equal(releaseAttemptLease(takeover.lease, { owner: 'automatic' }).released, false);
  assert.equal(releaseAttemptLease(takeover.lease, { owner: 'repair' }).released, true);
});

test('ledger stores and releases one safe lease per final', () => {
  const ledger = new DeliveryLedger();
  ledger.persist(envelope('q1'));
  const acquired = ledger.acquireAttemptLease('q1', { owner: 'pilot', now: 100, ttlMs: 1000 });
  assert.equal(acquired.accepted, true);
  assert.equal(isAttemptLeaseActive(ledger.get('q1').attemptLease, 200), true);
  assert.equal(ledger.acquireAttemptLease('q1', { owner: 'repair', now: 300 }).accepted, false);
  ledger.markFailed(['q1'], 'receiver_missing', 400);
  assert.equal(ledger.get('q1').attemptLease, null);
});