import test from 'node:test';
import assert from 'node:assert/strict';

const recoveryModule = await import('../shared/managed-tab-recovery.js').catch(() => null);

const managed = (id, title, url) => ({ id, title, url, discarded: false });

test('managed-tab recovery selects only exact PMIA provider lifecycle tabs', () => {
  assert.ok(recoveryModule, 'managed-tab recovery helper must exist');
  const tabs = [
    managed(1, 'PMIA_BOOT_SENDER_CHATGPT_PMIA_20260815_201848_9851', 'https://chatgpt.com/c/abc'),
    managed(2, 'PMIA_RECEIVER_CLAUDE_PMIA_20260815_201848_9851', 'https://claude.ai/chat/abc'),
    managed(3, 'PMIA_ARMED_COMPARISON_CHATGPT_PMIA_20260815_201848_9851', 'https://chatgpt.com/c/xyz'),
    managed(4, 'ChatGPT', 'https://chatgpt.com/'),
    managed(5, 'PMIA_BOOT_SENDER_CHATGPT_PMIA_20260815_201848_9851', 'https://example.com/')
  ];
  assert.deepEqual(
    recoveryModule.selectManagedRecoveryCandidates(tabs).map(item => item.tabId),
    [1, 2, 3]
  );
});

test('background recovery reloads only unresponsive exact managed tabs without activation', async () => {
  assert.ok(recoveryModule, 'managed-tab recovery helper must exist');
  const reloads = [];
  const updates = [];
  const chromeApi = {
    tabs: {
      query: async () => [
        managed(10, 'PMIA_BOOT_SENDER_CHATGPT_PMIA_20260815_201848_9851', 'https://chatgpt.com/c/a'),
        managed(11, 'PMIA_RECEIVER_CLAUDE_PMIA_20260815_201848_9851', 'https://claude.ai/chat/b'),
        managed(12, 'Claude', 'https://claude.ai/new')
      ],
      sendMessage: async tabId => tabId === 11
        ? { ok: true, sessionId: 'pmia_20260815_201848_9851', role: 'receiver', provider: 'claude' }
        : Promise.reject(new Error('Receiving end does not exist')),
      update: async (tabId, value) => { updates.push([tabId, value]); return {}; },
      reload: async tabId => { reloads.push(tabId); }
    }
  };
  const result = await recoveryModule.recoverInvalidatedManagedTabs({ chromeApi });
  assert.deepEqual(reloads, [10]);
  assert.deepEqual(updates, [[10, { autoDiscardable: false }]]);
  assert.deepEqual(result.reloadedTabIds, [10]);
  assert.equal(JSON.stringify(updates).includes('active'), false);
  assert.equal(JSON.stringify(updates).includes('highlighted'), false);
});

test('service worker probes and repairs invalidated managed tabs on restart and extension reload', async () => {
  const { readFile } = await import('node:fs/promises');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const background = await readFile(resolve(root, 'background.js'), 'utf8');
  assert.match(background, /recoverInvalidatedManagedTabs/);
  assert.match(background, /scheduleManagedTabRecovery\('worker_start'\)/);
  assert.match(background, /onInstalled[\s\S]*scheduleManagedTabRecovery\('extension_installed'\)/);
  assert.doesNotMatch(background, /tabs\.update\([^\n]*active:\s*true/);
});
