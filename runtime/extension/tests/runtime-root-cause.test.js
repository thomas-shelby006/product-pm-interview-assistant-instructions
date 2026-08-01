import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRuntimeRootCause } from '../shared/runtime-root-cause.js';

test('root cause classifier returns one primary cause and preserves secondary symptoms', () => {
  const result = classifyRuntimeRootCause({
    stateCompatibility: { state: 'blocked' },
    storagePressure: { level: 'critical', percent: 96 },
    sender: { connected: false }, receiver: { connected: false }, timeline: []
  }, 100);
  assert.equal(result.code, 'state_compatibility');
  assert.ok(result.suppressed.some(item => item.code === 'storage_critical'));
  assert.ok(result.suppressed.some(item => item.code === 'registration_missing'));
});

test('healthy runtime produces a no-action root cause', () => {
  const role = { connected: true, phase: 'ready', adapterCapabilityProbation: { writeSafe: true }, transportLane: { state: 'closed' } };
  const result = classifyRuntimeRootCause({ sender: role, receiver: role, timeline: [] }, 100);
  assert.equal(result.code, 'healthy');
  assert.equal(result.nextAction, '');
});
