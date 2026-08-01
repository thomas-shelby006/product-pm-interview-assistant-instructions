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
  assert.match(provider.drafts.at(-1), /EARLIER QUESTION 1:[\s\S]*Question 1[\s\S]*LATEST QUESTION \(HIGHEST PRIORITY\):[\s\S]*Question 2/);
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


test('explicit interrupt stops generation and submits only the latest waiting final', async () => {
  const provider = adapter();
  const submitted = [];
  let stops = 0;
  provider.stopGenerating = () => {
    stops += 1;
    provider.generating = false;
    return true;
  };
  const runtime = createReceiverBatchRuntime({
    adapter: provider,
    waitFn: async () => {},
    async submitBatch(batch) { submitted.push(batch); return { ok: true, proof: { verified: true } }; }
  });
  await runtime.accept(envelope('q1', 1));
  provider.generating = true;
  await runtime.accept(envelope('q2', 2));
  await runtime.accept(envelope('q3', 3));
  const result = await runtime.interruptLatest();
  assert.equal(result.delivered, true);
  assert.equal(stops, 1);
  assert.deepEqual(submitted.map(batch => batch.prompt.memberIds), [['q1'], ['q3']]);
  assert.deepEqual(runtime.snapshot().next.prompt.memberIds, ['q2']);
});

test('failed interrupt preserves the complete next batch', async () => {
  const provider = adapter();
  provider.stopGenerating = () => false;
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: provider,
    async submitBatch(batch) { submitted.push(batch); return { ok: true }; }
  });
  await runtime.accept(envelope('q1', 1));
  provider.generating = true;
  await runtime.accept(envelope('q2', 2));
  await runtime.accept(envelope('q3', 3));
  const result = await runtime.interruptLatest();
  assert.equal(result.error, 'stop_failed');
  assert.deepEqual(runtime.snapshot().next.prompt.memberIds, ['q2', 'q3']);
  assert.equal(submitted.length, 1);
});

test('batch policy controls emit state and drain only when released', async () => {
  const provider = adapter();
  const events = [];
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: provider,
    onEvent: event => events.push(event),
    async submitBatch(batch) { submitted.push(batch); return { ok: true }; }
  });
  await runtime.setHold(true);
  await runtime.accept(envelope('q1', 1));
  assert.equal(submitted.length, 0);
  await runtime.setAutoSubmit(false);
  await runtime.setHold(false);
  assert.equal(submitted.length, 0);
  await runtime.setAutoSubmit(true);
  assert.equal(submitted.length, 1);
  assert.equal(events.filter(event => event.type === 'batch_policy_changed').length, 4);
});


test('unverified submit action remains staged until rendered proof arrives', async () => {
  const provider = adapter();
  const events = [];
  const runtime = createReceiverBatchRuntime({
    adapter: provider,
    onEvent: event => events.push(event),
    async submitBatch() {
      return { ok: true, proof: { ok: true, verified: false, proof: 'submit_action_only' } };
    }
  });
  const result = await runtime.accept(envelope('q1', 1));
  assert.equal(result.ok, true);
  assert.equal(result.delivered, false);
  assert.equal(result.staged, true);
  assert.equal(result.reason, 'proof_pending');
  assert.equal(events.find(event => event.type === 'batch_submitted').verified, false);
});


test('receiver runtime submits partitioned batches sequentially without losing later finals', async () => {
  const submitted = [];
  const planner = new BatchPlanner({}, { maxBatchMembers: 2 });
  const runtime = createReceiverBatchRuntime({
    adapter: { isGenerating: () => false, setComposerText: () => true, getConversationMessages: () => [] },
    planner,
    submitBatch: async batch => { submitted.push(batch.prompt.memberIds); return { ok: true, proof: { verified: true } }; }
  });
  for (let seq = 1; seq <= 5; seq += 1) planner.add(envelope(`q${seq}`, seq));
  await runtime.submitNext();
  await runtime.answerComplete(planner.active().id);
  await runtime.answerComplete(planner.active().id);
  assert.deepEqual(submitted, [['q1', 'q2'], ['q3', 'q4'], ['q5']]);
});
