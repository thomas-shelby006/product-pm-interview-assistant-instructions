import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDeliverySla } from '../shared/delivery-sla-policy.js';

function snapshot(ageMs, extra = {}) {
  const now = 100000;
  return {
    mode: 'active',
    ledger: [{ id: 'q1', state: 'persisted', persistedAt: now - ageMs, updatedAt: now - ageMs }],
    receiver: { generating: false },
    storagePressure: { level: 'normal' },
    deliverySla: {},
    ...extra
  };
}

test('delivery SLA escalates through catch-up live check and repair', () => {
  assert.equal(deriveDeliverySla(snapshot(25000), 100000).action, 'catch_up');
  assert.equal(deriveDeliverySla(snapshot(50000), 100000).action, 'check_live');
  assert.equal(deriveDeliverySla(snapshot(95000), 100000).action, 'repair');
});

test('delivery SLA suppresses escalation while paused generating or storage critical', () => {
  assert.equal(deriveDeliverySla(snapshot(95000, { mode: 'paused' }), 100000).state, 'suppressed');
  assert.equal(deriveDeliverySla(snapshot(95000, { receiver: { generating: true } }), 100000).state, 'answering');
  assert.equal(deriveDeliverySla(snapshot(95000, { storagePressure: { level: 'critical' } }), 100000).state, 'suppressed');
});

test('delivery SLA respects action cooldown', () => {
  const value = snapshot(95000, { deliverySla: { lastAction: 'repair', lastActionAt: 90000 } });
  const decision = deriveDeliverySla(value, 100000, { cooldownMs: 30000 });
  assert.equal(decision.state, 'cooldown');
  assert.equal(decision.action, '');
});

test('proven active answer suppresses delivery repair for protected later finals', () => {
  const result = deriveDeliverySla({
    mode: 'active',
    ledger: [{ id: 'q2', state: 'persisted', persistedAt: 1000 }],
    batchState: { active: { batchId: 'b1', proof: { verified: true } } },
    answerState: { state: 'waiting', batchId: 'b1' },
    receiver: { generating: false },
    storagePressure: { level: 'normal' }
  }, 100000);
  assert.equal(result.action, '');
  assert.equal(result.state, 'answer_waiting');
  assert.equal(result.reason, 'proven_batch_answer_pending');
});

test('terminal answer does not suppress genuinely unresolved delivery', () => {
  const result = deriveDeliverySla({
    mode: 'active',
    ledger: [{ id: 'q2', state: 'persisted', persistedAt: 1000 }],
    batchState: { active: null },
    answerState: { state: 'no_response', batchId: 'b1' },
    receiver: { generating: false },
    storagePressure: { level: 'normal' }
  }, 100000);
  assert.equal(result.action, 'repair');
});
