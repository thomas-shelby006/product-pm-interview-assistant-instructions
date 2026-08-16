import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/role-queue.js').catch(() => null);

const turn = id => ({ sessionId:'s1', turnId:id, text:`Q-${id}`, kind:'question' });

test('role queue module exists', () => {
  assert.ok(mod, 'simple/role-queue.js must exist');
});

test('role queue preserves FIFO order and processes each turn once', async () => {
  const seen = [];
  const q = mod.createRoleQueue({ role:'receiver', deliverOne: async item => { seen.push(item.turnId); return { stage:'rendered' }; } });
  const results = await Promise.all([q.push(turn('1')), q.push(turn('2')), q.push(turn('3'))]);
  assert.deepEqual(seen, ['1','2','3']);
  assert.deepEqual(results.map(r => r.stage), ['rendered','rendered','rendered']);
  assert.equal(q.snapshot().pending, 0);
});

test('duplicate role delivery key returns original terminal result without resubmitting', async () => {
  let calls = 0;
  const q = mod.createRoleQueue({ role:'comparison', deliverOne: async () => { calls += 1; return { stage:'rendered' }; } });
  const first = await q.push(turn('1'));
  const second = await q.push(turn('1'));
  assert.equal(calls, 1);
  assert.equal(second.stage, first.stage);
  assert.equal(second.duplicate, true);
});

test('one role failure does not poison later turns', async () => {
  const seen = [];
  const q = mod.createRoleQueue({ role:'receiver', deliverOne: async item => {
    seen.push(item.turnId);
    if (item.turnId === '1') throw new Error('provider unavailable');
    return { stage:'rendered' };
  }});
  const first = await q.push(turn('1'));
  const second = await q.push(turn('2'));
  assert.equal(first.stage, 'failed');
  assert.equal(second.stage, 'rendered');
  assert.deepEqual(seen, ['1','2']);
});

test('receiver and comparison queues progress independently', async () => {
  let releaseReceiver;
  const receiver = mod.createRoleQueue({ role:'receiver', deliverOne: () => new Promise(resolve => { releaseReceiver = resolve; }) });
  const comparison = mod.createRoleQueue({ role:'comparison', deliverOne: async () => ({ stage:'rendered' }) });
  const receiverPending = receiver.push(turn('1'));
  const comparisonResult = await comparison.push(turn('1'));
  assert.equal(comparisonResult.stage, 'rendered');
  releaseReceiver({ stage:'rendered' });
  assert.equal((await receiverPending).stage, 'rendered');
});
