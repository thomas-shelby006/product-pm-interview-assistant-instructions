import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTurn } from '../simple/protocol.js';

const mod = await import('../simple/coordinator.js').catch(() => null);

function memoryStore() {
  const values = new Map();
  return {
    values,
    async put(key, value) { values.set(key, value); },
    async remove(key) { values.delete(key); }
  };
}

test('simple coordinator module exists', () => assert.ok(mod));

test('coordinator scopes registrations to one session and role', async () => {
  const c = mod.createSimpleCoordinator({ unresolvedStore:memoryStore() });
  c.register({ sessionId:'s1', role:'receiver', provider:'claude', deliver:async () => ({ stage:'rendered' }) });
  c.register({ sessionId:'s2', role:'receiver', provider:'chatgpt', deliver:async () => ({ stage:'rendered' }) });
  const result = await c.dispatchTurn(makeTurn({ sessionId:'s1', turnId:'1', text:'Q?' }));
  assert.deepEqual(Object.keys(result), ['receiver']);
  assert.equal(result.receiver.provider, 'claude');
});

test('coordinator begins receiver and comparison delivery concurrently', async () => {
  const c = mod.createSimpleCoordinator({ unresolvedStore:memoryStore() });
  const starts = [];
  const gates = {};
  for (const role of ['receiver','comparison']) c.register({
    sessionId:'s1', role, provider:role === 'receiver' ? 'claude' : 'chatgpt',
    deliver:() => new Promise(resolve => { starts.push(role); gates[role]=resolve; })
  });
  const pending = c.dispatchTurn(makeTurn({ sessionId:'s1', turnId:'1', text:'Q?' }));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(starts.sort(), ['comparison','receiver']);
  gates.receiver({ stage:'rendered' });
  gates.comparison({ stage:'rendered' });
  const result = await pending;
  assert.equal(result.receiver.stage, 'rendered');
  assert.equal(result.comparison.stage, 'rendered');
});

test('coordinator persists only unresolved role deliveries', async () => {
  const store = memoryStore();
  const c = mod.createSimpleCoordinator({ unresolvedStore:store });
  c.register({ sessionId:'s1', role:'receiver', provider:'claude', deliver:async () => ({ stage:'rendered' }) });
  c.register({ sessionId:'s1', role:'comparison', provider:'chatgpt', deliver:async () => ({ stage:'failed', reason:'not_ready' }) });
  const turn = makeTurn({ sessionId:'s1', turnId:'1', text:'Q?' });
  const result = await c.dispatchTurn(turn);
  assert.equal(result.receiver.stage, 'rendered');
  assert.equal(result.comparison.stage, 'failed');
  assert.equal(store.values.size, 1);
  assert.ok(store.values.has('s1:1:comparison'));
});

test('coordinator works in two-window receiver-only mode', async () => {
  const c = mod.createSimpleCoordinator({ unresolvedStore:memoryStore() });
  c.register({ sessionId:'s1', role:'receiver', provider:'claude', deliver:async () => ({ stage:'rendered' }) });
  const result = await c.dispatchTurn(makeTurn({ sessionId:'s1', turnId:'1', text:'Q?' }));
  assert.equal(result.receiver.stage, 'rendered');
  assert.equal(result.comparison, undefined);
});
