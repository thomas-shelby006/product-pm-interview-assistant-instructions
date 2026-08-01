import test from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityProbation } from '../content/capability-probation.js';

test('capability probation blocks writes after repeated critical samples and recovers only after stable health', () => {
  const policy = new CapabilityProbation({ criticalThreshold: 2, healthyThreshold: 3 });
  assert.equal(policy.observe({ complete: false, missingRequired: ['composer'] }, 1).writeSafe, true);
  const blocked = policy.observe({ complete: false, missingRequired: ['composer'] }, 2);
  assert.equal(blocked.state, 'blocked');
  assert.equal(blocked.writeSafe, false);
  assert.equal(policy.observe({ complete: true }, 3).state, 'recovering');
  assert.equal(policy.observe({ complete: true }, 4).writeSafe, false);
  const healthy = policy.observe({ complete: true }, 5);
  assert.equal(healthy.state, 'healthy');
  assert.equal(healthy.writeSafe, true);
});
