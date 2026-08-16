import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/claude-bridge.js').catch(() => null);

test('Claude simple bridge module exists', () => assert.ok(mod));

test('Claude bridge request resolves only matching acknowledgement', async () => {
  const target = new EventTarget();
  target.addEventListener(mod.CLAUDE_WRITE_REQUEST, event => {
    target.dispatchEvent(new CustomEvent(mod.CLAUDE_WRITE_RESPONSE, {
      detail:{ requestId:event.detail.requestId, ok:true, matches:true }
    }));
  });
  const bridge = mod.createClaudeWriteBridge(target);
  const result = await bridge.write('Tradeoff?', { timeoutMs:100 });
  assert.deepEqual(result, { ok:true, matches:true });
});

test('Claude bridge times out rather than reporting visible DOM as success', async () => {
  const bridge = mod.createClaudeWriteBridge(new EventTarget());
  const result = await bridge.write('Tradeoff?', { timeoutMs:5 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'bridge_timeout');
});
