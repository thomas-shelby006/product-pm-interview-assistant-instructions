import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAllowRuntimeLeaseMigration } from '../shared/registration-migration.js';

const existing = { tabId: 5, instanceId: 'lease-1' };

test('active replacement tab may take a lease from an inactive prior tab', async () => {
  assert.equal(await shouldAllowRuntimeLeaseMigration({
    existing,
    incomingTab: { id: 9, active: true },
    getTab: async () => ({ id: 5, active: false })
  }), true);
});

test('inactive duplicate tab cannot displace an active managed runtime', async () => {
  assert.equal(await shouldAllowRuntimeLeaseMigration({
    existing,
    incomingTab: { id: 9, active: false },
    getTab: async () => ({ id: 5, active: true })
  }), false);
});

test('missing prior tab permits lease recovery', async () => {
  assert.equal(await shouldAllowRuntimeLeaseMigration({
    existing,
    incomingTab: { id: 9, active: true },
    getTab: async () => { throw new Error('missing'); }
  }), true);
});
