import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimpleCoordinator } from '../simple/coordinator.js';

function store() { return { put:async () => {}, remove:async () => {} }; }

test('boot goes directly to answer roles and never requires a sender registration', async () => {
  const seen = [];
  const c = createSimpleCoordinator({ unresolvedStore:store() });
  for (const role of ['receiver','comparison']) c.register({
    sessionId:'s1', role, provider:role === 'receiver' ? 'claude' : 'chatgpt',
    deliver:async turn => { seen.push({ role, kind:turn.kind, text:turn.text }); return { stage:'rendered' }; }
  });
  const result = await c.dispatchBoot({ sessionId:'s1', text:'Session context' });
  assert.equal(result.receiver.stage, 'rendered');
  assert.equal(result.comparison.stage, 'rendered');
  assert.deepEqual(seen.map(value => value.kind), ['boot','boot']);
});

test('boot identifiers do not consume or constrain live question identifiers', async () => {
  const ids = [];
  const c = createSimpleCoordinator({ unresolvedStore:store() });
  c.register({ sessionId:'s1', role:'receiver', provider:'claude', deliver:async turn => { ids.push(turn.turnId); return { stage:'rendered' }; } });
  await c.dispatchBoot({ sessionId:'s1', text:'Context' });
  await c.dispatchTurn({ sessionId:'s1', turnId:'provider-turn-1', text:'Question?', kind:'question' });
  assert.match(ids[0], /^boot:/);
  assert.equal(ids[1], 'provider-turn-1');
});
