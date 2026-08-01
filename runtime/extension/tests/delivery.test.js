import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDelivery } from '../shared/delivery.js';

test('delivery is successful only when receiver explicitly acknowledges it', () => {
  assert.deepEqual(classifyDelivery({ route: { tabId: 2 }, response: { ok: true } }), {
    delivered: true,
    queued: false,
    reason: 'accepted'
  });
  assert.deepEqual(classifyDelivery({ route: { tabId: 2 }, response: { ok: false, error: 'no_composer' } }), {
    delivered: false,
    queued: true,
    reason: 'no_composer'
  });
});

test('missing receiver and transport errors remain queued', () => {
  assert.deepEqual(classifyDelivery({ route: null }), {
    delivered: false,
    queued: true,
    reason: 'receiver_missing'
  });
  assert.deepEqual(classifyDelivery({
    route: { tabId: 2 },
    error: new Error('Extension context invalidated')
  }), {
    delivered: false,
    queued: true,
    reason: 'transport_error'
  });
});


test('delivery preserves receiver acknowledgement reason for accepted retries', () => {
  assert.deepEqual(classifyDelivery({
    route: { tabId: 2 },
    response: { ok: true, reason: 'duplicate_ack', duplicate: true }
  }), {
    delivered: false,
    queued: false,
    duplicate: true,
    reason: 'duplicate_ack'
  });
});

test('delivery preserves specific receiver failure reason for diagnostics', () => {
  assert.deepEqual(classifyDelivery({
    route: { tabId: 2 },
    response: { ok: false, error: 'receiver_delivery_failed' }
  }), {
    delivered: false,
    queued: true,
    reason: 'receiver_delivery_failed'
  });
});

test('delivery wakes and retries the same envelope before queueing', async () => {
  const module = await import('../shared/delivery.js');
  assert.equal(typeof module.deliverWithWakeRetry, 'function');
  const calls = [];
  let attempts = 0;
  const outcome = await module.deliverWithWakeRetry({
    route: { tabId: 22, message: { id: 'q1', sessionId: 's1', text: 'Question?' } },
    async sendToTab(tabId, outgoing) {
      calls.push(['send', tabId, outgoing.envelope.id]);
      attempts += 1;
      return attempts === 1
        ? { ok: false, error: 'receiver_delivery_failed' }
        : { ok: true, reason: 'accepted' };
    },
    async wakeTab(tabId) { calls.push(['wake', tabId]); },
    async wait(ms) { calls.push(['wait', ms]); },
    retryDelaysMs: [80]
  });
  assert.deepEqual(calls, [
    ['send', 22, 'q1'], ['wake', 22], ['wait', 80], ['send', 22, 'q1']
  ]);
  assert.deepEqual(outcome, { delivered: true, queued: false, reason: 'accepted' });
});


test('stale acknowledgement remains staged until rendered proof exists', () => {
  assert.deepEqual(classifyDelivery({
    route: { tabId: 2 },
    response: { ok: true, reason: 'stale_ack', duplicate: true }
  }), {
    delivered: false,
    queued: false,
    duplicate: true,
    reason: 'stale_ack'
  });
});

test('staged receiver ownership stops transport retries immediately', async () => {
  const module = await import('../shared/delivery.js');
  let sends = 0;
  const outcome = await module.deliverWithWakeRetry({
    route: { tabId: 2, message: { id: 'q1', sessionId: 's1' } },
    async sendToTab() {
      sends += 1;
      return { ok: true, staged: true, reason: 'receiver_busy', batchId: 'next', memberIds: ['q1'] };
    },
    async wakeTab() { throw new Error('staged delivery must not wake'); },
    async wait() { throw new Error('staged delivery must not retry'); }
  });
  assert.equal(sends, 1);
  assert.equal(outcome.staged, true);
  assert.deepEqual(outcome.memberIds, ['q1']);
});

test('accepted receiver delivery never carries sender-terminal semantics', () => {
  const outcome = classifyDelivery({ route: { tabId: 2 }, response: { ok: true } });
  assert.equal(outcome.delivered, true);
  assert.equal('terminal' in outcome, false);
});


test('accepted gap buffering stops transport retry without marking rendered delivery', () => {
  const outcome = classifyDelivery({ route: { tabId: 1 }, response: {
    ok: true, buffered: true, reason: 'buffered_gap', expectedSeq: 2, bufferedCount: 1
  }});
  assert.deepEqual(outcome, {
    delivered: false, queued: true, buffered: true, reason: 'buffered_gap',
    expectedSeq: 2, bufferedCount: 1, duplicate: false
  });
});


test('duplicate acknowledgement is idempotent and not a fresh rendered delivery', () => {
  assert.deepEqual(classifyDelivery({ route: { tabId: 1 }, response: {
    ok: true, duplicate: true, reason: 'duplicate_ack'
  }}), {
    delivered: false, queued: false, duplicate: true, reason: 'duplicate_ack'
  });
});
