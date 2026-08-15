import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRuntimeConfig } from '../shared/protocol.js';
import { SessionRegistry } from '../shared/session-registry.js';
import { exportManagedSession } from '../shared/session-control.js';

test('comparison is a valid non-authoritative answer role', () => {
  const value = parseRuntimeConfig('https://claude.ai/new?pmia_session=s1&pmia_role=comparison&pmia_provider=claude');
  assert.deepEqual(value, { sessionId:'s1', role:'comparison', provider:'claude' });
});

test('registry keeps comparison ownership separate from canonical receiver routing', () => {
  const registry = new SessionRegistry();
  registry.register({ sessionId:'s1', role:'sender', provider:'chatgpt', tabId:1 }, { now:10 });
  registry.register({ sessionId:'s1', role:'receiver', provider:'chatgpt', tabId:2 }, { now:10 });
  registry.register({ sessionId:'s1', role:'comparison', provider:'claude', tabId:3 }, { now:10 });
  assert.equal(registry.route('s1', { id:'q1' }).tabId, 2);
  assert.equal(registry.comparisonRoute('s1', { id:'q1' }).tabId, 3);
  assert.equal(registry.roleForTab('s1', 3), 'comparison');
});

test('session export includes comparison when present but does not require it', async () => {
  const registry = new SessionRegistry();
  for (const [role,provider,tabId] of [['sender','chatgpt',1],['receiver','chatgpt',2],['comparison','claude',3]]) registry.register({ sessionId:'s1', role, provider, tabId }, { now:10 });
  const calls = [];
  const result = await exportManagedSession({ registry, sessionId:'s1', sendToTab:async(tabId)=>{ calls.push(tabId); return { ok:true }; } });
  assert.deepEqual(calls, [1,2,3]);
  assert.deepEqual(result.exportedTabIds, [1,2,3]);
});
