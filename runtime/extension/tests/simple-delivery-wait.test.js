import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverTurn } from '../simple/deliver-turn.js';

const turn = { sessionId:'s1', turnId:'t1', text:'Metric?', kind:'question' };

test('delivery waits for a temporarily unavailable provider write without duplicating submission', async () => {
  let writes = 0;
  let submits = 0;
  const adapter = {
    async write() { writes += 1; return writes >= 3; },
    verifyComposer() { return writes >= 3; },
    submit() { submits += 1; return true; },
    async verifyRenderedTurn() { return true; }
  };
  const result = await deliverTurn({ adapter, turn, writeTimeoutMs:50, submitTimeoutMs:50, retryIntervalMs:1 });
  assert.equal(result.stage, 'rendered');
  assert.equal(writes, 3);
  assert.equal(submits, 1);
});

test('delivery waits for Send availability after one successful composer write', async () => {
  let writes = 0;
  let submits = 0;
  const adapter = {
    async write() { writes += 1; return true; },
    verifyComposer() { return true; },
    submit() { submits += 1; return submits >= 4; },
    async verifyRenderedTurn() { return true; }
  };
  const result = await deliverTurn({ adapter, turn, writeTimeoutMs:50, submitTimeoutMs:50, retryIntervalMs:1 });
  assert.equal(result.stage, 'rendered');
  assert.equal(writes, 1);
  assert.equal(submits, 4);
});
