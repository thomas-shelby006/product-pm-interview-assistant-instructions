import test from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../simple/deliver-turn.js').catch(() => null);
const turn = { sessionId:'s1', turnId:'t1', text:'Metric?', kind:'question' };

test('simple delivery module exists', () => assert.ok(mod));

test('delivery succeeds only after write submit and rendered proof', async () => {
  const calls = [];
  const stages = [];
  const adapter = {
    async write(text) { calls.push(['write',text]); return true; },
    verifyComposer(text) { calls.push(['verifyComposer',text]); return true; },
    submit() { calls.push(['submit']); return true; },
    async verifyRenderedTurn(text) { calls.push(['rendered',text]); return true; }
  };
  const result = await mod.deliverTurn({ adapter, turn, onStage:value => stages.push(value.stage) });
  assert.equal(result.stage, 'rendered');
  assert.deepEqual(calls.map(value => value[0]), ['write','verifyComposer','submit','rendered']);
  assert.deepEqual(stages, ['composer_written','submitted','rendered']);
});

test('composer fill without submit is failure', async () => {
  const adapter = {
    async write() { return true; },
    verifyComposer() { return true; },
    submit() { return false; },
    async verifyRenderedTurn() { throw new Error('must not verify'); }
  };
  const result = await mod.deliverTurn({ adapter, turn, submitTimeoutMs:0 });
  assert.equal(result.stage, 'failed');
  assert.equal(result.reason, 'submit_unavailable');
});

test('submit without rendered provider turn is failure', async () => {
  const adapter = {
    async write() { return true; },
    verifyComposer() { return true; },
    submit() { return true; },
    async verifyRenderedTurn() { return false; }
  };
  const result = await mod.deliverTurn({ adapter, turn });
  assert.equal(result.stage, 'failed');
  assert.equal(result.reason, 'render_not_verified');
});
