import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/live-port.js').catch(() => null);

function fakePort(name) {
  const messages = [];
  const messageListeners = [];
  const disconnectListeners = [];
  let disconnected = false;
  return {
    name,
    messages,
    postMessage(value) {
      if (disconnected) throw new Error('Attempting to use a disconnected port object');
      messages.push(value);
    },
    onMessage:{
      addListener(fn) { messageListeners.push(fn); },
      removeListener(fn) { const i = messageListeners.indexOf(fn); if (i >= 0) messageListeners.splice(i, 1); }
    },
    onDisconnect:{ addListener(fn) { disconnectListeners.push(fn); } },
    emit(value) { messageListeners.forEach(fn => fn(value)); },
    disconnect() {
      if (disconnected) return;
      disconnected = true;
      disconnectListeners.forEach(fn => fn());
    }
  };
}

test('live port module exists', () => assert.ok(mod));

test('resilient port reconnects once on underlying disconnect and preserves message listeners', () => {
  const first = fakePort('first');
  const second = fakePort('second');
  const ports = [first, second];
  const reconnects = [];
  const received = [];
  const port = mod.createResilientPort({
    connect:() => ports.shift(),
    onReconnect:raw => reconnects.push(raw.name)
  });
  port.onMessage.addListener(value => received.push(value));
  port.postMessage({ n:1 });
  first.disconnect();
  second.emit({ n:2 });
  port.postMessage({ n:3 });
  assert.deepEqual(first.messages, [{ n:1 }]);
  assert.deepEqual(second.messages, [{ n:3 }]);
  assert.deepEqual(received, [{ n:2 }]);
  assert.deepEqual(reconnects, ['second']);
});
test('explicit wrapper disconnect does not reconnect and notifies permanent disconnect listeners', () => {
  const first = fakePort('first');
  let connects = 0;
  const port = mod.createResilientPort({ connect:() => { connects += 1; return first; } });
  let disconnected = 0;
  port.onDisconnect.addListener(() => { disconnected += 1; });
  port.disconnect();
  assert.equal(connects, 1);
  assert.equal(disconnected, 1);
});

test('postMessage recovers from a stale underlying port without a timer', () => {
  const first = fakePort('first');
  const second = fakePort('second');
  const ports = [first, second];
  const port = mod.createResilientPort({ connect:() => ports.shift() });
  first.disconnect();
  port.postMessage({ recovered:true });
  assert.deepEqual(second.messages, [{ recovered:true }]);
});