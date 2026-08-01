import test from 'node:test';
import assert from 'node:assert/strict';
import { electRegistryOwner } from '../shared/owner-election.js';

test('fresh higher-generation owner wins deterministic election', () => {
  const result = electRegistryOwner({ instanceId: 'old', ownerGeneration: 3, leaseExpiresAt: 200 }, { instanceId: 'new', ownerGeneration: 4 }, { now: 100, leaseMs: 100 });
  assert.equal(result.winner, 'incoming');
  assert.equal(result.registration.ownerGeneration, 4);
});

test('expired owner can be replaced while fresh higher generation blocks stale incoming', () => {
  assert.equal(electRegistryOwner({ instanceId: 'old', ownerGeneration: 5, leaseExpiresAt: 50 }, { instanceId: 'new', ownerGeneration: 1 }, { now: 100 }).winner, 'incoming');
  assert.equal(electRegistryOwner({ instanceId: 'old', ownerGeneration: 5, leaseExpiresAt: 200 }, { instanceId: 'new', ownerGeneration: 4 }, { now: 100 }).winner, 'existing');
});