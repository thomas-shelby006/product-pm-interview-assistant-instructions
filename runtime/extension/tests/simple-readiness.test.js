import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/readiness.js').catch(() => null);

test('readiness helper exists', () => assert.ok(mod));

test('provider readiness resolves immediately when composer is present', async () => {
  let checks = 0;
  const ready = await mod.waitForProviderReady({ isReady:() => { checks += 1; return true; } }, { timeoutMs:50, intervalMs:1 });
  assert.equal(ready, true);
  assert.equal(checks, 1);
});

test('provider readiness waits without serializing other windows', async () => {
  let checks = 0;
  const adapter = { isReady:() => ++checks >= 3 };
  assert.equal(await mod.waitForProviderReady(adapter, { timeoutMs:50, intervalMs:1 }), true);
  assert.equal(checks, 3);
});

test('provider readiness fails closed when composer never appears', async () => {
  const ready = await mod.waitForProviderReady({ isReady:() => false }, { timeoutMs:5, intervalMs:1 });
  assert.equal(ready, false);
});
