import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createReceiverAnswerSettlement } from '../content/receiver-answer-settlement.js';

test('terminal callback and promise completion settle one batch exactly once', async () => {
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const settlement = createReceiverAnswerSettlement({
    async completeBatch(batchId, payload) {
      calls += 1;
      await gate;
      return { ok: true, batchId, state: payload.answerState.state };
    }
  });
  settlement.begin({ batchId: 'b1', proof: { verified: true } });
  const first = settlement.settle({ ok: true, answerState: { batchId: 'b1', state: 'complete' } });
  const second = settlement.settle({ ok: true, answerState: { batchId: 'b1', state: 'complete' } });
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, { ok: true, batchId: 'b1', state: 'complete' });
  assert.equal((await settlement.settle({ answerState: { batchId: 'b1', state: 'complete' } })).duplicate, true);
});

test('failed settlement remains retryable and reports the error', async () => {
  let attempts = 0;
  const errors = [];
  const settlement = createReceiverAnswerSettlement({
    completeBatch() {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary_failure');
      return { ok: true };
    },
    onError(error) { errors.push(error.message); }
  });
  settlement.begin({ batchId: 'b2' });
  assert.equal((await settlement.settle({ answerState: { batchId: 'b2', state: 'no_response' } })).ok, false);
  assert.deepEqual(errors, ['temporary_failure']);
  assert.equal((await settlement.settle({ answerState: { batchId: 'b2', state: 'no_response' } })).ok, true);
});


test('stale terminal result cannot settle another active batch', async () => {
  const settlement = createReceiverAnswerSettlement({ completeBatch: async () => ({ ok: true }) });
  settlement.begin({ batchId: 'current' });
  const result = await settlement.settle({ answerState: { batchId: 'stale', state: 'complete' } });
  assert.deepEqual(result, { ok: false, error: 'answer_settlement_missing', batchId: 'stale' });
  assert.equal(settlement.snapshot().pendingBatchId, 'current');
});

test('receiver entry converges terminal callback and returned promise on one settlement owner', async () => {
  const entry = await readFile(new URL('../content/entry.js', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.match(entry, /onTerminal\(value\)[\s\S]*receiverAnswerSettlement\?\.settle\(value\)/);
  assert.match(entry, /receiverAnswerSettlement\?\.begin\(\{ batchId: batch\.id, proof \}\)/);
  assert.match(entry, /\.then\(answer => receiverAnswerSettlement\?\.settle\(answer\)\)/);
  assert.ok(manifest.web_accessible_resources.flatMap(item => item.resources || []).includes('content/receiver-answer-settlement.js'));
});
