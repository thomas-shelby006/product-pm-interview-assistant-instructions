import test from 'node:test';
import assert from 'node:assert/strict';
import { probeRegistrationOwner } from '../shared/registration-health.js';

const registration = {
  sessionId: 's1', role: 'receiver', provider: 'claude', tabId: 22, instanceId: 'runtime-1'
};

test('registration health accepts only the expected PMIA runtime identity', async () => {
  const result = await probeRegistrationOwner({
    registration,
    getTab: async () => ({ id: 22 }),
    sendToTab: async () => ({
      ok: true,
      sessionId: 's1',
      role: 'receiver',
      provider: 'claude',
      instanceId: 'runtime-1'
    })
  });
  assert.deepEqual(result, { responsive: true, reason: 'healthy' });
});

test('registration health treats a missing tab as replaceable', async () => {
  const result = await probeRegistrationOwner({
    registration,
    getTab: async () => { throw new Error('No tab'); },
    sendToTab: async () => ({ ok: true })
  });
  assert.deepEqual(result, { responsive: false, reason: 'tab_missing' });
});

test('registration health replaces an unresponsive or mismatched runtime', async () => {
  const unreachable = await probeRegistrationOwner({
    registration,
    getTab: async () => ({ id: 22 }),
    sendToTab: async () => { throw new Error('No receiver'); }
  });
  assert.deepEqual(unreachable, { responsive: false, reason: 'runtime_unreachable' });

  const mismatched = await probeRegistrationOwner({
    registration,
    getTab: async () => ({ id: 22 }),
    sendToTab: async () => ({
      ok: true,
      sessionId: 'other',
      role: 'receiver',
      provider: 'claude'
    })
  });
  assert.deepEqual(mismatched, {
    responsive: false,
    reason: 'invalid_runtime_response'
  });
});

test('registration health rejects a different runtime instance in the same tab', async () => {
  const result = await probeRegistrationOwner({
    registration,
    getTab: async () => ({ id: 22 }),
    sendToTab: async () => ({
      ok: true, sessionId: 's1', role: 'receiver', provider: 'claude', instanceId: 'runtime-2'
    })
  });
  assert.deepEqual(result, { responsive: false, reason: 'invalid_runtime_response' });
});
