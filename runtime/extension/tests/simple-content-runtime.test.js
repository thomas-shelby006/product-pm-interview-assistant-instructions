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

test('sender inspection returns recent questions only when explicitly requested', () => {
  const port = fakePort();
  const adapter = { readUserTurns:() => Array.from({ length:22 }, (_, i) => ({ id:`q${i}`, text:`Q${i}` })) };
  const runtime = mod.createSimpleContentRuntime({ config:{ sessionId:'s1', role:'sender', provider:'chatgpt' }, adapter, port });
  runtime.start();
  port.emit({ type:'inspect_request', requestId:'i1', scope:'review' });
  const result = port.sent.find(value => value.type === 'inspect_result');
  assert.equal(result.requestId, 'i1');
  assert.equal(result.result.recentQuestions.length, 20);
  assert.equal(result.result.recentQuestions[0].id, 'q2');
});

test('answer inspection returns metrics without raw answer text', () => {
  const port = fakePort();
  const adapter = { readLatestAssistantText:() => 'one two three four' };
  const runtime = mod.createSimpleContentRuntime({ config:{ sessionId:'s1', role:'receiver', provider:'claude' }, adapter, port });
  runtime.start();
  port.emit({ type:'inspect_request', requestId:'i2', scope:'review' });
  const result = port.sent.find(value => value.type === 'inspect_result');
  assert.equal(result.result.available, true);
  assert.equal(result.result.metrics.wordCount, 4);
  assert.equal('text' in result.result, false);
});

test('resumed sender scans current DOM instead of baselining first live turn', async () => {
  const port = fakePort();
  const adapter = { readUserTurns:() => [{ id:'first-live', text:'Activation metric?' }] };
  const runtime = mod.createSimpleContentRuntime({
    config:{ sessionId:'s-nav', role:'sender', provider:'chatgpt' },
    adapter,
    port,
    senderState:{ resumed:true, initialSeen:[] }
  });
  runtime.start();
  await new Promise(resolve => setImmediate(resolve));
  const captured = port.sent.find(value => value.type === 'stage' && value.stage === 'captured');
  const turn = port.sent.find(value => value.type === 'turn');
  assert.equal(captured?.turnId, 'first-live');
  assert.equal(turn?.turn?.turnId, 'first-live');
});
