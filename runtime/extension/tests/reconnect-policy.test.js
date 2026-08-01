import test from 'node:test';
import assert from 'node:assert/strict';
import { ReconnectPolicy } from '../shared/reconnect-policy.js';

test('reconnect policy applies capped exponential delay and bounded jitter', () => {
  const policy = new ReconnectPolicy({ baseMs: 100, capMs: 1000, random: () => 0.5 });
  assert.equal(policy.next().delayMs, 100);
  assert.equal(policy.next().delayMs, 200);
  assert.equal(policy.next().delayMs, 400);
  assert.equal(policy.next().delayMs, 800);
  assert.equal(policy.next().delayMs, 1000);
});

test('reconnect policy permits one half-open probe and resets after success', () => {
  const policy = new ReconnectPolicy({ baseMs: 100, random: () => 0.5 });
  assert.equal(policy.beginProbe(), true);
  assert.equal(policy.beginProbe(), false);
  policy.succeed();
  assert.equal(policy.snapshot().attempt, 0);
  assert.equal(policy.beginProbe(), true);
});