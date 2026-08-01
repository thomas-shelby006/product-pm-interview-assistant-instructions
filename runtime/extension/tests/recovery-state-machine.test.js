import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryChecksComplete, transitionRecovery } from '../shared/recovery-state-machine.js';

test('repair remains pending until every semantic check is true', () => {
  let state = transitionRecovery(null, { type: 'repair_requested' }, 100);
  state = transitionRecovery(state, { type: 'checks_updated', checks: { sender: true, receiver: true, adapters: true, batch: true, storage: true } }, 110);
  state = transitionRecovery(state, { type: 'verify' }, 120);
  assert.equal(state.phase, 'repairing');
  assert.equal(state.verified, false);
  state = transitionRecovery(state, { type: 'checks_updated', checks: { reconciliation: true } }, 130);
  state = transitionRecovery(state, { type: 'verify' }, 140);
  assert.equal(state.phase, 'healthy');
  assert.equal(state.verified, true);
});

test('critical storage blocks recovery and timeout degrades it', () => {
  let state = transitionRecovery(null, { type: 'repair_requested' }, 100);
  state = transitionRecovery(state, { type: 'checks_updated', checks: { storage: false }, storageCritical: true }, 110);
  assert.equal(state.phase, 'blocked');
  state = transitionRecovery(state, { type: 'timeout', error: 'verification_timeout' }, 120);
  assert.equal(state.phase, 'degraded');
});

test('check completeness is explicit', () => {
  assert.equal(recoveryChecksComplete({ sender: true, receiver: true, adapters: true, reconciliation: true, batch: true, storage: true }), true);
  assert.equal(recoveryChecksComplete({ sender: true }), false);
});


test('blocked recovery returns to repairing when storage becomes safe', () => {
  let state = transitionRecovery(null, { type: 'repair_requested' }, 100);
  state = transitionRecovery(state, { type: 'checks_updated', checks: { storage: false }, storageCritical: true }, 110);
  state = transitionRecovery(state, { type: 'checks_updated', checks: { storage: true }, storageCritical: false }, 120);
  assert.equal(state.phase, 'repairing');
  assert.equal(state.error, '');
});
