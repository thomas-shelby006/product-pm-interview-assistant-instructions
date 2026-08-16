import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/content-runtime.js').catch(() => null);

function fakePort() {
  const listeners = [];
  const sent = [];
  return {
    sent,
    postMessage(value) { sent.push(value); },
    onMessage:{ addListener(fn) { listeners.push(fn); } },
    emit(value) { for (const fn of listeners) fn(value); }
  };
}

test('simple content runtime module exists', () => assert.ok(mod));

test('sender posts a new rendered turn directly to its long-lived port', async () => {
  const port = fakePort();
  let turns = [{ id:'old', text:'Old' }];
  const adapter = { readUserTurns:() => turns };
  const runtime = mod.createSimpleContentRuntime({
    config:{ sessionId:'s1', role:'sender', provider:'chatgpt' }, adapter, port
  });
  runtime.start();
  turns = [{ id:'old', text:'Old' }, { id:'new', text:'New?' }];
  await runtime.scanSender();
  assert.equal(port.sent[0].type, 'register');
  assert.equal(port.sent[1].type, 'stage');
  assert.equal(port.sent[1].stage, 'captured');
  assert.equal(port.sent[2].type, 'turn');
  assert.equal(port.sent[2].turn.turnId, 'new');
});

test('answer runtime returns terminal result only after delivery contract completes', async () => {
  const port = fakePort();
  const calls = [];
  const adapter = {
    async write(text) { calls.push(['write',text]); return true; },
    verifyComposer() { return true; },
    submit() { calls.push(['submit']); return true; },
    async verifyRenderedTurn() { calls.push(['rendered']); return true; }
  };
  const runtime = mod.createSimpleContentRuntime({
    config:{ sessionId:'s1', role:'receiver', provider:'claude' }, adapter, port
  });
  runtime.start();
  port.emit({ type:'deliver', requestId:'r1', turn:{ sessionId:'s1', turnId:'t1', text:'Q?', kind:'question' } });
  await new Promise(resolve => setTimeout(resolve, 20));
  const result = port.sent.find(value => value.type === 'delivery_result');
  assert.ok(result);
  assert.equal(result.requestId, 'r1');
  assert.equal(result.result.stage, 'rendered');
  assert.deepEqual(calls.map(value => value[0]), ['write','submit','rendered']);
});
