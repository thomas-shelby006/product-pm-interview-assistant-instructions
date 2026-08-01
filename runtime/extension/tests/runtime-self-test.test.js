import test from 'node:test';
import assert from 'node:assert/strict';
import { runRuntimeSelfTest } from '../shared/runtime-self-test.js';

test('runtime self-test measures both roles storage and dashboard without content', async () => {
  let clock = 1000;
  const probes = [];
  const result = await runRuntimeSelfTest({
    now: () => clock,
    dashboardConnections: 1,
    async probeRole(role, nonce) {
      probes.push({ role, nonce });
      clock += role === 'sender' ? 12 : 18;
      return { ok: true, probe: 'pmia_self_test', role, composerReady: true };
    },
    async storageRoundTrip(nonce) {
      clock += 7;
      return { ok: true, matched: true, nonceLength: nonce.length };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.roles.sender.rttMs, 12);
  assert.equal(result.roles.receiver.rttMs, 18);
  assert.equal(result.storage.rttMs, 7);
  assert.equal(result.dashboard.connected, true);
  assert.equal(JSON.stringify(result).includes('question'), false);
  assert.deepEqual(probes.map(item => item.role), ['sender', 'receiver']);
});

test('runtime self-test fails when one role storage or dashboard is unavailable', async () => {
  const result = await runRuntimeSelfTest({
    dashboardConnections: 0,
    probeRole: async role => role === 'sender' ? { ok: true, probe: 'pmia_self_test', role } : { ok: false, error: 'receiver_missing' },
    storageRoundTrip: async () => ({ ok: false, error: 'storage_failed' })
  });
  assert.equal(result.ok, false);
  assert.equal(result.roles.receiver.ok, false);
  assert.equal(result.storage.ok, false);
  assert.equal(result.dashboard.connected, false);
});
