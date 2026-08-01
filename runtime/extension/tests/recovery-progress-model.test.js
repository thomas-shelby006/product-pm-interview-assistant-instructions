import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRecoveryProgress } from '../dashboard/recovery-progress-model.js';

test('Recovery Progress reports every semantic verification check', () => {
  const value = deriveRecoveryProgress({ lastRepair: { phase: 'repairing', checks: { sender: true, receiver: true, adapters: false } } });
  assert.equal(value.phase, 'repairing');
  assert.equal(value.complete, 2);
  assert.equal(value.total, 6);
});
