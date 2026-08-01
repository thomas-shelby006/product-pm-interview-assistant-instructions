import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveMemoryGuard } from '../dashboard/memory-guard-model.js';

test('Memory Guard exposes protected and reclaimable categories', () => {
  const value = deriveMemoryGuard({ storagePressure: { level: 'high', percent: 87, breakdown: {
    actionable: 100, proven: 200, telemetry: 50, snapshots: 25
  }}});
  assert.equal(value.actionableBytes, 100);
  assert.equal(value.reclaimableBytes, 250);
  assert.equal(value.blocked, false);
});

test('critical pressure blocks new persistence acknowledgement', () => {
  assert.equal(deriveMemoryGuard({ storagePressure: { level: 'critical' } }).blocked, true);
});
