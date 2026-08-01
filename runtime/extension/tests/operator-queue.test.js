import test from 'node:test';
import assert from 'node:assert/strict';
import { OperatorQueue } from '../shared/operator-queue.js';

function envelope(id, seq = 1, kind = 'question') {
  return {
    id,
    sessionId: 'pmia_session',
    sourceProvider: 'chatgpt',
    kind,
    seq,
    text: `Question ${id}`,
    metadata: {},
    createdAt: seq
  };
}

test('operator queue accepts only final non-boot envelopes', () => {
  const queue = new OperatorQueue();
  assert.equal(queue.enqueue(envelope('boot', 1, 'boot')).accepted, false);
  assert.equal(queue.enqueue(envelope('q1')).accepted, true);
  assert.equal(queue.size, 1);
});

test('operator queue is idempotent and bounded', () => {
  const queue = new OperatorQueue([], { maxItems: 2 });
  queue.enqueue(envelope('q1', 1), { now: 1 });
  assert.equal(queue.enqueue(envelope('q1', 1), { now: 2 }).reason, 'duplicate');
  queue.enqueue(envelope('q2', 2), { now: 2 });
  const third = queue.enqueue(envelope('q3', 3), { now: 3 });
  assert.deepEqual(third.dropped.map(item => item.id), ['q1']);
  assert.deepEqual(queue.list().map(item => item.id), ['q2', 'q3']);
});

test('queue send lifecycle removes delivered items and retains failures', () => {
  const queue = new OperatorQueue();
  queue.enqueue(envelope('q1'));
  assert.equal(queue.markSending('q1').attempts, 1);
  assert.equal(queue.complete('q1', { delivered: false, reason: 'offline' }).item.status, 'failed');
  assert.equal(queue.size, 1);
  queue.markSending('q1');
  assert.equal(queue.complete('q1', { delivered: true }).delivered, true);
  assert.equal(queue.size, 0);
});


test('delivering a newer queued final supersedes older retained items', () => {
  const queue = new OperatorQueue();
  queue.enqueue(envelope('q1', 1));
  queue.enqueue(envelope('q2', 2));
  queue.markSending('q2');
  const delivered = queue.complete('q2', { delivered: true });
  const superseded = queue.supersedeBefore(delivered.item.envelope.seq);
  assert.deepEqual(superseded.map(item => item.id), ['q1']);
  assert.equal(queue.get('q1').status, 'superseded');
});


test('unavailable receiver returns a queued item to queued state', () => {
  const queue = new OperatorQueue();
  queue.enqueue(envelope('q1', 1));
  queue.markSending('q1');
  const outcome = queue.complete('q1', { queued: true, reason: 'receiver_missing' });
  assert.equal(outcome.queued, true);
  assert.equal(queue.get('q1').status, 'queued');
  assert.equal(queue.get('q1').lastError, 'receiver_missing');
});
