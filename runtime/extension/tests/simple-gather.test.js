import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimpleContentRuntime } from '../simple/content-runtime.js';

function port() {
  const listeners = [];
  return {
    sent:[],
    postMessage(value) { this.sent.push(value); },
    onMessage:{ addListener(fn) { listeners.push(fn); } },
    emit(value) { listeners.forEach(fn => fn(value)); }
  };
}

test('auto-forward off gathers new rendered turns without sending them', async () => {
  const p = port();
  let turns = [];
  const runtime = createSimpleContentRuntime({
    config:{ sessionId:'s1', role:'sender', provider:'chatgpt' }, adapter:{ readUserTurns:() => turns }, port:p
  });
  runtime.start();
  p.emit({ type:'control', command:'set_auto_forward', enabled:false });
  turns = [{ id:'a', text:'First fragment' }, { id:'b', text:'second fragment' }];
  await runtime.scanSender();
  assert.equal(p.sent.filter(value => value.type === 'turn').length, 0);
  assert.equal(runtime.snapshot().held, 2);
});

test('send gathered emits one combined turn in arrival order', async () => {
  const p = port();
  let turns = [];
  const runtime = createSimpleContentRuntime({
    config:{ sessionId:'s1', role:'sender', provider:'chatgpt' }, adapter:{ readUserTurns:() => turns }, port:p
  });
  runtime.start();
  p.emit({ type:'control', command:'set_auto_forward', enabled:false });
  turns = [{ id:'a', text:'First fragment' }, { id:'b', text:'second fragment' }];
  await runtime.scanSender();
  p.emit({ type:'control', command:'send_gathered' });
  await new Promise(resolve => setImmediate(resolve));
  const sent = p.sent.filter(value => value.type === 'turn');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].turn.text, 'First fragment\nsecond fragment');
  assert.equal(runtime.snapshot().held, 0);
});
