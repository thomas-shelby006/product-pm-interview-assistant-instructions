import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportManagedSession,
  exportManagedSessionForTab
} from '../shared/session-control.js';



function registryWithPair(sessionId = 'pmia_20260730_233536_1287') {
  return {
    getSession(id) {
      if (id !== sessionId) return null;
      return { sessionId, sender: { tabId: 11 }, receiver: { tabId: 22 } };
    }
  };
}

test('internal export targets exactly one registered sender and receiver', async () => {
  const calls = [];
  const result = await exportManagedSession({
    registry: registryWithPair(),
    sessionId: 'pmia_20260730_233536_1287',
    sendToTab: async (tabId, message) => {
      calls.push({ tabId, message });
      return { ok: true };
    }
  });
  assert.deepEqual(calls, [
    { tabId: 11, message: { type: 'PMIA_EXPORT_SESSION', sessionId: 'pmia_20260730_233536_1287' } },
    { tabId: 22, message: { type: 'PMIA_EXPORT_SESSION', sessionId: 'pmia_20260730_233536_1287' } }
  ]);
  assert.deepEqual(result, { ok: true, exportedTabIds: [11, 22] });
});

test('internal export rejects incomplete or failed role delivery', async () => {
  const incomplete = await exportManagedSession({
    registry: { getSession: () => ({ sender: { tabId: 11 }, receiver: null }) },
    sessionId: 'pmia_missing',
    sendToTab: async () => ({ ok: true })
  });
  assert.deepEqual(incomplete, { ok: false, error: 'incomplete_session' });

  const failed = await exportManagedSession({
    registry: registryWithPair(),
    sessionId: 'pmia_20260730_233536_1287',
    sendToTab: async tabId => tabId === 11 ? { ok: true } : { ok: false, error: 'export_failed' }
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.error, 'export_failed');
});




test('browser command resolves the active managed tab to one exact session export', async () => {
  const calls = [];
  const registry = {
    exportState() {
      return [
        { sessionId: 'pmia_other', sender: { tabId: 91 }, receiver: { tabId: 92 } },
        { sessionId: 'pmia_target', sender: { tabId: 11 }, receiver: { tabId: 22 } }
      ];
    },
    getSession(id) {
      return this.exportState().find(session => session.sessionId === id) || null;
    }
  };
  const result = await exportManagedSessionForTab({
    registry,
    tabId: 11,
    sendToTab: async (targetTabId, message) => {
      calls.push({ targetTabId, message });
      return { ok: true };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.sessionId, 'pmia_target');
  assert.deepEqual(calls.map(call => call.targetTabId), [11, 22]);
});

test('browser command rejects unmanaged or ambiguous active tabs', async () => {
  const registry = {
    exportState() {
      return [
        { sessionId: 'pmia_a', sender: { tabId: 11 }, receiver: { tabId: 22 } },
        { sessionId: 'pmia_b', sender: { tabId: 11 }, receiver: { tabId: 33 } }
      ];
    },
    getSession() { return null; }
  };
  const ambiguous = await exportManagedSessionForTab({ registry, tabId: 11, sendToTab: async () => ({ ok: true }) });
  assert.deepEqual(ambiguous, { ok: false, error: 'ambiguous_active_tab' });
  const missing = await exportManagedSessionForTab({ registry, tabId: 999, sendToTab: async () => ({ ok: true }) });
  assert.deepEqual(missing, { ok: false, error: 'unmanaged_active_tab' });
});
