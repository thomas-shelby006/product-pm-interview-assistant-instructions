import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRecoveryAction } from '../shared/recovery-escalation-policy.js';

test('recovery selects one cause-specific action and respects budget exhaustion', () => {
  assert.equal(selectRecoveryAction({ code: 'sequence_gap' }, { budget: { remaining: 2 } }).action, 'reconcile');
  assert.equal(selectRecoveryAction({ code: 'registration_missing' }, { budget: { remaining: 2 }, roleHealth: { activeAnswer: true } }).action, 'reconnect');
  const exhausted = selectRecoveryAction({ code: 'transport_unavailable' }, { budget: { remaining: 0 } });
  assert.equal(exhausted.action, 'operator_handoff');
  assert.equal(exhausted.reason, 'recovery_budget_exhausted');
});
