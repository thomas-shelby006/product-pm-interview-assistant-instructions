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
