import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimpleCoordinator } from '../simple/coordinator.js';

function memoryStore() {
  const values = new Map();
  return {
    values,
    async put(key, value) { values.set(key, value); },
    async remove(key) { values.delete(key); },
    async list() { return [...values.entries()]; }
  };
}

test('a failed role delivery is retryable after the role reconnects', async () => {
  const store = memoryStore();
  const c = createSimpleCoordinator({ unresolvedStore:store });
  let attempts = 0;
  c.register({ sessionId:'s1', role:'receiver', provider:'claude', deliver:async () => {
    attempts += 1;
    return attempts === 1 ? { stage:'failed', reason:'disconnected' } : { stage:'rendered' };
  }});
  const turn = { sessionId:'s1', turnId:'t1', text:'Q?', kind:'question' };
  const first = await c.dispatchTurn(turn);
  assert.equal(first.receiver.stage, 'failed');
  assert.equal(store.values.size, 1);
  const retried = await c.retryRole('s1', 'receiver');
  assert.equal(retried[0].stage, 'rendered');
  assert.equal(attempts, 2);
  assert.equal(store.values.size, 0);
});

test('reconnect never replays a role that already rendered the turn', async () => {
  const store = memoryStore();
  const c = createSimpleCoordinator({ unresolvedStore:store });
  let receiverCalls = 0;
  let comparisonCalls = 0;
  c.register({ sessionId:'s1', role:'receiver', provider:'claude', deliver:async () => { receiverCalls += 1; return { stage:'rendered' }; } });
  c.register({ sessionId:'s1', role:'comparison', provider:'chatgpt', deliver:async () => { comparisonCalls += 1; return { stage:'failed' }; } });
  await c.dispatchTurn({ sessionId:'s1', turnId:'t1', text:'Q?', kind:'question' });
  assert.equal(receiverCalls, 1);
  await c.retryRole('s1', 'receiver');
  assert.equal(receiverCalls, 1);
  assert.equal(comparisonCalls, 1);
});
