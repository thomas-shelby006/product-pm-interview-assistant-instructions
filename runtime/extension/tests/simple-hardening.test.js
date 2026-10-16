import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimpleSender } from '../simple/sender.js';
import { createSimpleCoordinator } from '../simple/coordinator.js';
import { createSimplePortRouter } from '../simple/port-router.js';
import { createSimpleClaudeAdapter } from '../simple/adapters/claude.js';
import { createSimpleChatGptAdapter } from '../simple/adapters/chatgpt.js';
import { deliverTurn } from '../simple/deliver-turn.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function memory() {
  const values = new Map();
  return { values, async put(k,v) { values.set(k,v); },
    async remove(k) { values.delete(k); }, async list() { return [...values.entries()]; } };
}
function port() {
  const messages = [], disconnects = [], sent = [];
  return { sent, postMessage(x) { sent.push(x); },
    onMessage:{ addListener(fn) { messages.push(fn); } },
    onDisconnect:{ addListener(fn) { disconnects.push(fn); } },
    emit(x) { for (const fn of messages) fn(x); },
    disconnect() { for (const fn of disconnects) fn(); } };
}
function node(text, id='') {
  return { textContent:text, innerText:text, value:text, id, getAttribute:key => key === 'data-message-id' ? id : null };
}
function doc(map) {
  return { querySelector:selector => map[selector]?.[0] || null,
    querySelectorAll:selector => map[selector] || [] };
}

test('failed handoff is not marked seen, and next scan retries the same question', async () => {
  let calls = 0;
  let seen = [];
  const sender = createSimpleSender({
    readTurns:() => [{ id:'t', text:'Critical question?' }],
    onTurn:async () => ++calls !== 1,
    onRetry:() => {},
    onSeenChange:keys => { seen=keys; }
  });
  await sender.scan();
  assert.equal(sender.snapshot().seen, 0);
  assert.deepEqual(seen, []);
  await sender.scan();
  assert.equal(calls, 2);
  assert.deepEqual(seen, ['id:t']);
});

test('concurrent sender scans share the same pending turn', async () => {
  let resolve;
  let calls = 0;
  const sender = createSimpleSender({
    readTurns:() => [{ id:'t', text:'Hello?' }],
    onTurn:() => { calls++; return new Promise(done => { resolve=done; }); }
  });
  const a = sender.scan(), b = sender.scan();
  await tick();
  assert.equal(calls, 1);
  resolve(true);
  await Promise.all([a,b]);
  assert.equal(sender.snapshot().seen, 1);
});

test('overlapping Claude message selectors capture one DOM node once', () => {
  const duplicate = node('Why this strategy?');
  const d = doc({ '[data-testid="user-message"]':[duplicate], '[data-testid*="user-message"]':[duplicate] });
  const adapter = createSimpleClaudeAdapter({ doc:d, writeInMain:async () => ({ ok:true }) });
  assert.deepEqual(adapter.readUserTurns(), [{ id:'claude-user-1', text:'Why this strategy?' }]);
});

for (const [name, create, selector] of [
  ['Claude', createSimpleClaudeAdapter, '[data-testid="user-message"]'],
  ['ChatGPT', createSimpleChatGptAdapter, 'section[data-turn="user"][data-turn-id]']
]) {
  test(`${name} does not mistake an old identical user turn for new submission proof`, async () => {
    const original = node('Same question?', 'old');
    const map = { [selector]:[original] };
    const d = doc(map);
    const adapter = create({ doc:d, writeInMain:async () => ({ ok:true }) });
    const baseline = adapter.renderedBaseline('Same question?');
    assert.equal(await adapter.verifyRenderedTurn('Same question?', { baseline, timeoutMs:0 }), false);
    map[selector].push(node('Same question?', 'new'));
    assert.equal(await adapter.verifyRenderedTurn('Same question?', { baseline, timeoutMs:0 }), true);
  });
}

test('deliverTurn passes a pre-submit baseline into proof verification', async () => {
  let baselineValue;
  const marker = new Set([1]);
  const result = await deliverTurn({
    turn:{ sessionId:'s', turnId:'q', text:'Test?' },
    adapter:{
      renderedBaseline:() => marker,
      write:async () => true, verifyComposer:() => true, submit:() => true,
      verifyRenderedTurn:async (_text, options) => { baselineValue=options.baseline; return true; }
    }
  });
  assert.equal(result.stage, 'rendered');
  assert.equal(baselineValue, marker);
});

test('late disconnect from replaced receiver cannot remove current registration', async () => {
  const c=createSimpleCoordinator({ unresolvedStore:memory() });
  const router=createSimplePortRouter({ coordinator:c });
  const old=port(), fresh=port(), source=port();
  for (const item of [old,fresh,source]) router.attach(item);
  old.emit({ type:'register', sessionId:'s', role:'receiver', provider:'claude' });
  fresh.emit({ type:'register', sessionId:'s', role:'receiver', provider:'claude' });
  old.disconnect();
  assert.ok(c.snapshot('s').receiver);
  source.emit({ type:'register', sessionId:'s', role:'sender', provider:'chatgpt' });
  source.emit({ type:'turn', turn:{ sessionId:'s', turnId:'q', text:'Hello?' } });
  await tick();
  const delivery=fresh.sent.find(m=>m.type==='deliver');
  assert.ok(delivery);
  fresh.emit({ type:'delivery_result', requestId:delivery.requestId, result:{ stage:'rendered' } });
  await tick();
  assert.equal(source.sent.find(m=>m.type==='turn_accepted')?.accepted,true);
});

test('offline configured role is checkpointed and delivered upon reconnect', async () => {
  const store=memory(), ids=new Set();
  const c=createSimpleCoordinator({ unresolvedStore:store,
    acceptedStore:{ has:async key => ids.has(key), add:async key => { ids.add(key); } }
  });
  c.configure('s',['receiver','comparison']);
  c.register({ sessionId:'s', role:'receiver', provider:'claude', deliver:async () => ({ stage:'rendered' }) });
  assert.equal((await c.acceptTurn({ sessionId:'s', turnId:'q', text:'Strategy?' })).accepted,true);
  await tick();
  assert.equal(store.values.has('s:q:comparison'),true);
  let attempts=0;
  c.register({ sessionId:'s', role:'comparison', provider:'chatgpt', deliver:async () => {
    attempts++; return { stage:'rendered' };
  } });
  const retry=await c.retryRole('s','comparison');
  assert.equal(retry[0].stage,'rendered');
  assert.equal(attempts,1);
});

test('storage checkpoint failure prevents sender acceptance', async () => {
  const c=createSimpleCoordinator({
    unresolvedStore:{ put:async () => { throw Error('quota'); }, remove:async () => {} },
    acceptedStore:{ has:async () => false, add:async () => { throw Error('should not accept'); } }
  });
  c.configure('s',['receiver']);
  await assert.rejects(c.acceptTurn({ sessionId:'s', turnId:'q', text:'Q?' }), /quota/);
});

test('render-proof timeout becomes uncertain and is not blindly replayed', async () => {
  const store=memory(), c=createSimpleCoordinator({ unresolvedStore:store });
  let attempts=0;
  c.register({ sessionId:'s', role:'receiver', provider:'claude', deliver:async () => {
    attempts++; return { stage:'failed', reason:'render_not_verified' };
  } });
  await c.dispatchTurn({ sessionId:'s', turnId:'q', text:'One?' });
  assert.equal(store.values.get('s:q:receiver').state,'uncertain');
  const result=await c.retryRole('s','receiver');
  assert.deepEqual(result,[]);
  assert.equal(attempts,1);
});

test('receipt does not depend on receiver-generated response completion', async () => {
  let finish;
  const store=memory(), c=createSimpleCoordinator({ unresolvedStore:store });
  c.register({ sessionId:'s', role:'receiver', provider:'claude', deliver:() => new Promise(resolve => { finish=resolve; }) });
  const router=createSimplePortRouter({ coordinator:c });
  const sender=port();
  router.attach(sender);
  sender.emit({ type:'register', sessionId:'s', role:'sender', provider:'chatgpt' });
  sender.emit({ type:'turn', turn:{ sessionId:'s', turnId:'q', text:'Question?' } });
  await tick();
  assert.equal(sender.sent.find(m=>m.type==='turn_accepted')?.accepted,true);
  finish({ stage:'rendered' });
});
