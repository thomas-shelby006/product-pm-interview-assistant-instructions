import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimpleCoordinator } from '../simple/coordinator.js';

const mod = await import('../simple/port-router.js').catch(() => null);

function port(name) {
  const listeners = [];
  const disconnects = [];
  const sent = [];
  return {
    name, sent,
    postMessage(value) { sent.push(value); },
    onMessage:{ addListener(fn) { listeners.push(fn); } },
    onDisconnect:{ addListener(fn) { disconnects.push(fn); } },
    emit(value) { listeners.forEach(fn => fn(value)); },
    disconnect() { disconnects.forEach(fn => fn()); }
  };
}

function store() { return { put:async () => {}, remove:async () => {} }; }

test('simple port router module exists', () => assert.ok(mod));

test('one sender turn is requested from receiver and comparison before either completes', async () => {
  const coordinator = createSimpleCoordinator({ unresolvedStore:store() });
  const router = mod.createSimplePortRouter({ coordinator, requestTimeoutMs:1000 });
  const sender = port('sender');
  const receiver = port('receiver');
  const comparison = port('comparison');
  [sender,receiver,comparison].forEach(value => router.attach(value));
  receiver.emit({ type:'register', sessionId:'s1', role:'receiver', provider:'claude' });
  comparison.emit({ type:'register', sessionId:'s1', role:'comparison', provider:'chatgpt' });
  sender.emit({ type:'register', sessionId:'s1', role:'sender', provider:'chatgpt' });
  sender.emit({ type:'turn', turn:{ sessionId:'s1', turnId:'t1', text:'Q?', kind:'question' } });
  await new Promise(resolve => setImmediate(resolve));
  const rReq = receiver.sent.find(value => value.type === 'deliver');
  const cReq = comparison.sent.find(value => value.type === 'deliver');
  assert.ok(rReq);
  assert.ok(cReq);
  receiver.emit({ type:'delivery_result', requestId:rReq.requestId, result:{ stage:'rendered' } });
  comparison.emit({ type:'delivery_result', requestId:cReq.requestId, result:{ stage:'rendered' } });
  await new Promise(resolve => setImmediate(resolve));
  const result = sender.sent.find(value => value.type === 'turn_result');
  assert.equal(result.results.receiver.stage, 'rendered');
  assert.equal(result.results.comparison.stage, 'rendered');
});

test('router does not preempt the answer runtime with a second delivery timeout', async () => {
  const coordinator = createSimpleCoordinator({ unresolvedStore:store() });
  const router = mod.createSimplePortRouter({ coordinator, requestTimeoutMs:5 });
  const sender = port('sender');
  const receiver = port('receiver');
  router.attach(sender); router.attach(receiver);
  receiver.emit({ type:'register', sessionId:'s1', role:'receiver', provider:'claude' });
  sender.emit({ type:'register', sessionId:'s1', role:'sender', provider:'chatgpt' });
  sender.emit({ type:'turn', turn:{ sessionId:'s1', turnId:'slow', text:'Q?', kind:'question' } });
  await new Promise(resolve => setImmediate(resolve));
  const req = receiver.sent.find(value => value.type === 'deliver');
  await new Promise(resolve => setTimeout(resolve, 20));
  receiver.emit({ type:'delivery_result', requestId:req.requestId, result:{ stage:'rendered' } });
  await new Promise(resolve => setImmediate(resolve));
  const result = sender.sent.find(value => value.type === 'turn_result');
  assert.equal(result.results.receiver.stage, 'rendered');
});

test('disconnect fails an in-flight role request immediately', async () => {
  const coordinator = createSimpleCoordinator({ unresolvedStore:store() });
  const router = mod.createSimplePortRouter({ coordinator });
  const sender = port('sender');
  const receiver = port('receiver');
  router.attach(sender); router.attach(receiver);
  receiver.emit({ type:'register', sessionId:'s1', role:'receiver', provider:'claude' });
  sender.emit({ type:'register', sessionId:'s1', role:'sender', provider:'chatgpt' });
  sender.emit({ type:'turn', turn:{ sessionId:'s1', turnId:'drop', text:'Q?', kind:'question' } });
  await new Promise(resolve => setImmediate(resolve));
  receiver.disconnect();
  await new Promise(resolve => setImmediate(resolve));
  const result = sender.sent.find(value => value.type === 'turn_result');
  assert.equal(result.results.receiver.stage, 'failed');
  assert.equal(result.results.receiver.reason, 'disconnected');
});

test('two-window mode sends only to receiver', async () => {
  const coordinator = createSimpleCoordinator({ unresolvedStore:store() });
  const router = mod.createSimplePortRouter({ coordinator, requestTimeoutMs:1000 });
  const sender = port('sender');
  const receiver = port('receiver');
  router.attach(sender); router.attach(receiver);
  receiver.emit({ type:'register', sessionId:'s1', role:'receiver', provider:'claude' });
  sender.emit({ type:'register', sessionId:'s1', role:'sender', provider:'chatgpt' });
  sender.emit({ type:'turn', turn:{ sessionId:'s1', turnId:'t1', text:'Q?', kind:'question' } });
  await new Promise(resolve => setImmediate(resolve));
  const req = receiver.sent.find(value => value.type === 'deliver');
  receiver.emit({ type:'delivery_result', requestId:req.requestId, result:{ stage:'rendered' } });
  await new Promise(resolve => setImmediate(resolve));
  const result = sender.sent.find(value => value.type === 'turn_result');
  assert.deepEqual(Object.keys(result.results), ['receiver']);
});

test('router exposes role registration to Studio launch readiness', () => {
  const registrations = [];
  const coordinator = createSimpleCoordinator({ unresolvedStore:store() });
  const router = mod.createSimplePortRouter({ coordinator, onRegister:value => registrations.push(value) });
  const receiver = port('receiver');
  router.attach(receiver);
  receiver.emit({ type:'register', sessionId:'s1', role:'receiver', provider:'claude' });
  assert.deepEqual(registrations, [{ sessionId:'s1', role:'receiver', provider:'claude', port:receiver }]);
});
