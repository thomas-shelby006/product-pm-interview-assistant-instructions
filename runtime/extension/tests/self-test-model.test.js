import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSelfTestView } from '../dashboard/self-test-model.js';

test('self-test view reports fresh pass and role RTTs', () => {
  const view = deriveSelfTestView({ selfTest: { ok: true, completedAt: 9000, roles: { sender: { ok: true, rttMs: 12 }, receiver: { ok: true, rttMs: 18 } }, storage: { ok: true, rttMs: 7 }, dashboard: { connected: true } } }, 10000);
  assert.equal(view.state, 'passed');
  assert.equal(view.fresh, true);
  assert.match(view.detail, /Window 1 12 ms/);
});

test('self-test view marks an old pass stale', () => {
  const view = deriveSelfTestView({ selfTest: { ok: true, completedAt: 1000 } }, 40000);
  assert.equal(view.state, 'stale');
  assert.equal(view.fresh, false);
});
