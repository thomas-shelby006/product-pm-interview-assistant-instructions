import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/dom.js');

test('DOM wait resolves from MutationObserver without waiting for fallback timer', async () => {
  let current = false;
  let callback = null;
  class Observer {
    constructor(fn) { callback = fn; }
    observe() {}
    disconnect() {}
  }
  const root = { ownerDocument:{ defaultView:{ MutationObserver:Observer } } };
  const pending = mod.waitForDom(() => current, { root, timeoutMs:5000, intervalMs:1000 });
  current = true;
  callback();
  assert.equal(await pending, true);
});

test('DOM wait returns immediately when proof already exists', async () => {
  assert.equal(await mod.waitForDom(() => true, { root:null, timeoutMs:5000 }), true);
});
