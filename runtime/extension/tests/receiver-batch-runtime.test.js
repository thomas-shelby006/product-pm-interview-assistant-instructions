import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiverBatchRuntime } from '../content/receiver-batch-runtime.js';

function envelope(id, seq) {
  return { id, sessionId: 's', sourceProvider: 'chatgpt', kind: 'question', seq, text: `Question ${seq}`, metadata: {}, createdAt: seq };
}

function adapter() {
  return {
    generating: false,
    drafts: [],
    isGenerating() { return this.generating; },
    setComposerText(text) { this.drafts.push(text); return true; }
  };
}

test('receiver batch runtime submits immediately while idle', async () => {
  const provider = adapter();
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: provider,
    async submitBatch(batch) { submitted.push(batch); return { ok: true, proof: { verified: true } }; }
  });
  const result = await runtime.accept(envelope('q1', 1));
  assert.equal(result.delivered, true);
  assert.deepEqual(submitted[0].prompt.memberIds, ['q1']);
});

test('receiver batch runtime accumulates and mirrors arrivals during generation', async () => {
  const provider = adapter();
  provider.generating = true;
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: provider,
    async submitBatch(batch) { submitted.push(batch); return { ok: true }; }
  });
  const first = await runtime.accept(envelope('q1', 1));
  const second = await runtime.accept(envelope('q2', 2));
  assert.equal(first.staged, true);
  assert.equal(second.staged, true);
  assert.equal(submitted.length, 0);
  assert.match(provider.drafts.at(-1), /Question 1:[\s\S]*Question 2:/);
});

test('answer completion drains the full accumulated next batch without stopping generation', async () => {
  const provider = adapter();
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: provider,
    async submitBatch(batch) { submitted.push(batch); return { ok: true, proof: { verified: true } }; }
  });
  await runtime.accept(envelope('q1', 1));
  provider.generating = true;
  await runtime.accept(envelope('q2', 2));
  await runtime.accept(envelope('q3', 3));
  provider.generating = false;
  await runtime.answerComplete(submitted[0].id);
  assert.deepEqual(submitted[1].prompt.memberIds, ['q2', 'q3']);
});

test('hold preserves the next draft until explicit submit', async () => {
  const provider = adapter();
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: provider,
    async submitBatch(batch) { submitted.push(batch); return { ok: true }; }
  });
  runtime.setHold(true);
  const result = await runtime.accept(envelope('q1', 1));
  assert.equal(result.staged, true);
  assert.equal(submitted.length, 0);
  await runtime.submitNext({ force: true });
  assert.equal(submitted.length, 1);
});


test('receiver reconciliation proves an already rendered batch without resubmission', async () => {
  const provider = adapter();
  provider.getConversationMessages = () => [{ id: 'u1', role: 'user', text: 'Rendered batch prompt' }];
  const events = [];
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: provider,
    async submitBatch(batch) { submitted.push(batch); return { ok: true }; },
    onEvent: event => events.push(event)
  });
  const result = await runtime.reconcile({
    batches: [{
      id: 'batch-1',
      memberIds: ['q1', 'q2'],
      prompt: { text: 'Rendered batch prompt', questionCount: 2, memberIds: ['q1', 'q2'] }
    }],
    pending: [envelope('q1', 1), envelope('q2', 2)]
  });
  assert.deepEqual(result.proven, ['batch-1']);
  assert.equal(result.replayed.length, 0);
  assert.equal(submitted.length, 0);
  assert.equal(events.some(event => event.type === 'batch_reconciled'), true);
});

test('receiver reconciliation replays only unresolved finals in sequence order', async () => {
  const provider = adapter();
  provider.getConversationMessages = () => [];
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: provider,
    async submitBatch(batch) { submitted.push(batch); return { ok: true }; }
  });
  const result = await runtime.reconcile({ pending: [envelope('q2', 2), envelope('q1', 1)] });
  assert.equal(result.replayed.length, 2);
  assert.deepEqual(submitted[0].prompt.memberIds, ['q1']);
  assert.deepEqual(runtime.snapshot().next.prompt.memberIds, ['q2']);
});
