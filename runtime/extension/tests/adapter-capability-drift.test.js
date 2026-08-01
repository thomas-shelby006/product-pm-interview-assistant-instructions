import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAdapterCapabilityDrift } from '../content/adapter-capability-drift.js';

test('capability drift marks removed required surface as critical', () => {
  const result = evaluateAdapterCapabilityDrift({ complete: true, required: ['submit'], submit: true }, { complete: false, required: ['submit'], submit: false }, null, 10);
  assert.equal(result.state, 'critical');
  assert.deepEqual(result.removed, ['submit']);
});

test('stable restoration clears drift after consecutive healthy samples', () => {
  const prior = { state: 'recovering', stableRecoveryCount: 1, firstSeenAt: 1 };
  const result = evaluateAdapterCapabilityDrift({ complete: true, required: ['submit'], submit: true }, { complete: true, required: ['submit'], submit: true }, prior, 20, { stableSamples: 2 });
  assert.equal(result.state, 'stable');
});