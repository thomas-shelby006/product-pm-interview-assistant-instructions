import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiverBatchRuntime } from '../content/receiver-batch-runtime.js';

const envelope = id => ({ id, seq: Number(id.slice(1)), kind: 'question', text: `Question ${id}`, sourceProvider: 'chatgpt', sessionId: 's1', createdAt: 1 });

test('queue-only stages finals without invoking provider submission', async () => {
  let submitted = 0;
  const runtime = createReceiverBatchRuntime({
    adapter: { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true },
    submitBatch: async () => { submitted += 1; return { ok: true }; }
  });
  await runtime.setQueueOnly(true, 'provider_capability_blocked');
  const result = await runtime.accept(envelope('q1'));
  assert.equal(result.staged, true);
  assert.equal(result.reason, 'queue_only');
  assert.equal(submitted, 0);
  assert.equal(runtime.snapshot().deliveryPolicy.active, true);
});

test('clearing queue-only resumes the protected batch without clearing operator hold', async () => {
  let submitted = 0;
  const runtime = createReceiverBatchRuntime({
    adapter: { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true },
    submitBatch: async batch => { submitted += 1; return { ok: true, proof: { ok: true, verified: true, memberIds: batch.prompt.memberIds } }; }
  });
  await runtime.setQueueOnly(true, 'provider_capability_blocked');
  await runtime.accept(envelope('q1'));
  await runtime.setHold(true);
  await runtime.setQueueOnly(false);
  assert.equal(submitted, 0);
  await runtime.setHold(false);
  assert.equal(submitted, 1);
});
