import test from 'node:test';
import assert from 'node:assert/strict';
import { BatchPlanner } from '../shared/batch-planner.js';
import { classifyTurnRelation } from '../shared/turn-coordination-policy.js';
import { createReceiverBatchRuntime } from '../content/receiver-batch-runtime.js';

function envelope(id, seq, text = `Question ${seq}`, metadata = {}) {
  return { id, sessionId: 's', sourceProvider: 'chatgpt', kind: 'question', seq, text, metadata, createdAt: seq };
}

test('adaptive relation policy interrupts only an exact same-turn continuation', () => {
  const continued = classifyTurnRelation({
    active: { sourceTurnId: 'turn-1', memberIds: ['q1'], outcome: 'interrupted' },
    incoming: { id: 'q2', continuationOf: 'turn-1', boundary: 'rendered_user_turn' },
    policy: 'adaptive',
    now: 100
  });
  assert.equal(continued.relation, 'continues_active');
  assert.equal(continued.autoInterrupt, true);
  assert.equal(continued.confidence, 'exact');

  const independent = classifyTurnRelation({
    active: { sourceTurnId: 'turn-1', memberIds: ['q1'], outcome: 'interrupted' },
    incoming: { id: 'q2', sourceTurnId: 'turn-2', boundary: 'rendered_user_turn' },
    policy: 'adaptive',
    now: 100
  });
  assert.equal(independent.relation, 'independent');
  assert.equal(independent.autoInterrupt, false);

  const manual = classifyTurnRelation({
    active: { sourceTurnId: 'turn-1', memberIds: ['q1'], outcome: 'interrupted' },
    incoming: { id: 'q2', continuationOf: 'turn-1', boundary: 'rendered_user_turn' },
    policy: 'manual',
    now: 100
  });
  assert.equal(manual.autoInterrupt, false);
});

test('planner carryover preserves active members and only selected continuation members', () => {
  const planner = new BatchPlanner();
  planner.add(envelope('q1', 1));
  const original = planner.freezeNext(10);
  planner.add(envelope('q2', 2));
  planner.add(envelope('q3', 3));
  const result = planner.createCarryover(20, {
    activeBatchId: original.id,
    continuationIds: ['q2']
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.batch.prompt.memberIds, ['q1', 'q2']);
  assert.deepEqual(result.interrupted.prompt.memberIds, ['q1']);
  assert.deepEqual(planner.next().prompt.memberIds, ['q3']);
});
test('receiver carryover stops once and resubmits active plus continuation members', async () => {
  let generating = false;
  let stopCalls = 0;
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: {
      provider: 'chatgpt',
      isGenerating: () => generating,
      stopGenerating: () => { stopCalls += 1; generating = false; return true; },
      setComposerText: () => true
    },
    submitBatch: async batch => {
      submitted.push(batch);
      generating = true;
      return { ok: true, proof: { ok: true, verified: true } };
    },
    waitFn: async () => {}
  });
  await runtime.accept(envelope('q1', 1, 'Original segment', { sourceTurnId: 'turn-1' }));
  await runtime.accept(envelope('q2', 2, 'Continuation', { continuationOf: 'turn-1' }));
  const activeBatchId = runtime.snapshot().active.id;
  const carried = await runtime.carryoverInterruption({
    activeBatchId,
    sourceSegmentIds: ['q1'],
    sourceOutcome: 'interrupted',
    continuationId: 'q2',
    generationToken: 'generation-1'
  });
  assert.equal(carried.ok, true);
  assert.equal(stopCalls, 1);
  assert.equal(submitted.length, 2);
  assert.deepEqual(submitted[1].prompt.memberIds, ['q1', 'q2']);
  assert.match(submitted[1].prompt.text, /previous answer was interrupted/i);

  const duplicate = await runtime.carryoverInterruption({
    activeBatchId,
    sourceSegmentIds: ['q1'],
    sourceOutcome: 'interrupted',
    continuationId: 'q2',
    generationToken: 'generation-1'
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error, 'interruption_token_replayed');
  assert.equal(stopCalls, 1);
});

test('failed Stop preserves the original active and waiting batches', async () => {
  let generating = false;
  const runtime = createReceiverBatchRuntime({
    adapter: {
      provider: 'chatgpt',
      isGenerating: () => generating,
      stopGenerating: () => false,
      setComposerText: () => true
    },
    submitBatch: async () => {
      generating = true;
      return { ok: true, proof: { ok: true, verified: true } };
    }
  });
  await runtime.accept(envelope('q1', 1, 'Original', { sourceTurnId: 'turn-1' }));
  await runtime.accept(envelope('q2', 2, 'Continuation', { continuationOf: 'turn-1' }));
  const before = runtime.snapshot();
  const result = await runtime.carryoverInterruption({
    activeBatchId: before.active.id,
    sourceSegmentIds: ['q1'],
    sourceOutcome: 'interrupted',
    continuationId: 'q2',
    generationToken: 'generation-failed'
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'stop_failed');
  assert.deepEqual(runtime.snapshot().active.prompt.memberIds, ['q1']);
  assert.deepEqual(runtime.snapshot().next.prompt.memberIds, ['q2']);
});

test('manual composer conflict keeps forwarding paused and retains every held member', async () => {
  let submitted = 0;
  const runtime = createReceiverBatchRuntime({
    adapter: { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true },
    draftArbiter: { snapshot: () => ({ owner: 'manual' }), writeBatch: () => false },
    submitBatch: async () => { submitted += 1; return { ok: true }; }
  });
  await runtime.pauseForwarding();
  await runtime.accept(envelope('q1', 1));
  const result = await runtime.resumeForwarding({ submit: true });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'draft_conflict');
  assert.equal(submitted, 0);
  assert.equal(runtime.snapshot().hold, true);
  assert.equal(runtime.snapshot().turnCoordination.mode, 'paused_accumulating');
  assert.deepEqual(runtime.snapshot().next.prompt.memberIds, ['q1']);
});

test('an authoritative revision of one stable DOM turn carries explicit continuation identity', async () => {
  const { createChatGptTurnTracker } = await import('../content/senders/chatgpt-turn-tracker.js');
  const tracker = createChatGptTurnTracker({ fallbackMs: 5000 });
  const message = (id, role, text, turnId = id) => ({ id, turnId, role, text });
  tracker.prime([]);
  const first = tracker.update([
    message('message-1', 'user', 'How would you prioritize?', 'turn-1')
  ], 10, { renderedBoundary: true });
  assert.equal(first.length, 1);
  const revision = tracker.update([
    message('message-1', 'user', 'How would you prioritize this launch across markets?', 'turn-1')
  ], 20, { renderedBoundary: true });
  assert.equal(revision.length, 1);
  assert.equal(revision[0].boundary, 'rendered_user_turn_revision');
  assert.equal(revision[0].sourceTurnId, 'turn-1');
  assert.equal(revision[0].continuationOf, 'turn-1');
  assert.equal(revision[0].revisionOf, 'message-1');
  assert.notEqual(revision[0].id, 'message-1');
});

test('receiver admission auto-carries an exact revision and never stops for an independent question', async () => {
  let generating = false;
  let stopCalls = 0;
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: {
      provider: 'chatgpt',
      isGenerating: () => generating,
      stopGenerating: () => { stopCalls += 1; generating = false; return true; },
      setComposerText: () => true
    },
    submitBatch: async batch => {
      submitted.push(batch);
      generating = true;
      return { ok: true, proof: { ok: true, verified: true } };
    },
    waitFn: async () => {}
  });
  await runtime.accept(envelope('q1', 1, 'Initial question', { sourceTurnId: 'turn-1', boundary: 'rendered_user_turn' }));
  const independent = await runtime.accept(envelope('q-independent', 2, 'Separate question', { sourceTurnId: 'turn-2', boundary: 'rendered_user_turn' }));
  assert.equal(independent.reason, 'receiver_busy');
  assert.equal(stopCalls, 0);
  const revision = await runtime.accept(envelope('q-revision', 3, 'Expanded original question', {
    sourceTurnId: 'turn-1',
    continuationOf: 'turn-1',
    revisionOf: 'message-1',
    sourceOutcome: 'interrupted',
    boundary: 'rendered_user_turn_revision'
  }));
  assert.equal(revision.ok, true);
  assert.equal(revision.reason, 'automatic_source_carryover');
  assert.equal(stopCalls, 1);
  assert.deepEqual(submitted.at(-1).prompt.memberIds, ['q1', 'q-revision']);
  assert.deepEqual(runtime.snapshot().next.prompt.memberIds, ['q-independent']);
});

test('carryover cancels the old answer exactly once before replacement submission', async () => {
  let generating = false;
  const order = [];
  const runtime = createReceiverBatchRuntime({
    adapter: {
      provider: 'chatgpt',
      isGenerating: () => generating,
      stopGenerating: () => { order.push('stop'); generating = false; return true; },
      setComposerText: () => true
    },
    cancelActiveAnswer: async (batchId, reason) => {
      order.push(`cancel:${batchId}:${reason}`);
      return { ok: true };
    },
    submitBatch: async batch => {
      order.push(`submit:${batch.prompt.memberIds.join(',')}`);
      generating = true;
      return { ok: true, proof: { ok: true, verified: true } };
    },
    waitFn: async () => {}
  });
  await runtime.accept(envelope('q1', 1, 'Original', { sourceTurnId: 'turn-1' }));
  await runtime.accept(envelope('q2', 2, 'Continuation', { continuationOf: 'turn-1' }));
  const activeBatchId = runtime.snapshot().active.id;
  const result = await runtime.carryoverInterruption({ activeBatchId, sourceSegmentIds: ['q1'], sourceOutcome: 'interrupted', continuationId: 'q2', generationToken: 'g-cancel' });
  assert.equal(result.ok, true);
  assert.deepEqual(order, [`submit:q1`, 'stop', `cancel:${activeBatchId}:superseded_turn`, 'submit:q1,q2']);
});