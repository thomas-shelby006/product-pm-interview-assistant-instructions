import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireRuntimeInstanceFence } from '../content/runtime-instance-fence.js';

test('one document permits one active runtime generation', () => {
  const host = {};
  const first = acquireRuntimeInstanceFence(host, { sessionId: 's1', role: 'sender', instanceId: 'a' });
  const second = acquireRuntimeInstanceFence(host, { sessionId: 's1', role: 'sender', instanceId: 'b' });
  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  first.release();
  assert.equal(acquireRuntimeInstanceFence(host, { sessionId: 's1', role: 'sender', instanceId: 'c' }).acquired, true);
});