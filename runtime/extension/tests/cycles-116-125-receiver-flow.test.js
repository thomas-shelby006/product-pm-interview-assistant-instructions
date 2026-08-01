import test from 'node:test';
import assert from 'node:assert/strict';
import { BatchPlanner, composeBatchPrompt } from '../shared/batch-planner.js';
import { deriveBatchPreview } from '../shared/batch-preview-model.js';
import { normalizeReceiverDeliveryPolicy, postAnswerDecision, updateReceiverDeliveryPolicy } from '../shared/receiver-delivery-policy.js';
import { acknowledgeAnswer, buildAnswerAcknowledgement, buildAnswerHandoff, buildInterruptPlan, deriveAnswerDeadlineView, resolveNoResponse } from '../shared/answer-operations.js';
import { createReceiverBatchRuntime } from '../content/receiver-batch-runtime.js';

function envelope(id, seq, text = `Question ${seq}`) {
  return { id, seq, kind: 'question', sourceProvider: 'chatgpt', text, metadata: {} };
}

test('Cycle 116: batch preview exposes exact membership without mutating planner state', () => {
  const planner = new BatchPlanner();
  planner.add(envelope('q1', 1)); planner.add(envelope('q2', 2));
  const before = planner.exportState();
  const preview = deriveBatchPreview({ plannerState: before, budget: planner.budget() });
  assert.deepEqual(preview.next.memberIds, ['q1', 'q2']);
  assert.equal(preview.next.focusId, 'q2');
  assert.deepEqual(planner.exportState(), before);
});

test('Cycle 117: preview reports provider budget and partition count', () => {
  const entries = Array.from({ length: 10 }, (_, index) => ({ id: `q${index}`, envelope: envelope(`q${index}`, index + 1), addedAt: index }));
  const preview = deriveBatchPreview({ plannerState: { next: { entries } }, budget: { maxMembers: 4, maxChars: 12000 } });
  assert.equal(preview.budget.maxMembers, 4);
  assert.equal(preview.next.partitionCount, 3);
});

test('Cycles 118-120: post-answer policy supports pause, bounded drain, and submit-on-idle', () => {
  assert.equal(postAnswerDecision({ pauseAfterAnswer: true }, { nextCount: 2, answerState: 'complete' }).action, 'pause');
  const drain = postAnswerDecision(updateReceiverDeliveryPolicy({}, { drainMode: 'one' }, 10), { nextCount: 2, answerState: 'complete' });
  assert.equal(drain.action, 'submit_next');
  assert.equal(drain.nextPolicy.drainMode, 'off');
  assert.equal(postAnswerDecision({ submitOnIdle: true }, { nextCount: 1, answerState: 'complete' }).action, 'submit_next');
  assert.equal(normalizeReceiverDeliveryPolicy({ drainMode: 'invalid' }).drainMode, 'off');
});

test('Cycles 121-123: answer acknowledgement, no-response resolution, and deadline view are explicit', () => {
  const answer = buildAnswerAcknowledgement({ batchId: 'b1', memberIds: ['q1'], answerState: { state: 'complete' } }, 100);
  assert.equal(acknowledgeAnswer(answer, 120).acknowledgedAt, 120);
  assert.equal(resolveNoResponse({ batchId: 'b1' }, 'retry', 130).nextAction, 'retry_completed_batch');
  assert.equal(resolveNoResponse({ batchId: 'b1' }, 'continue', 130).nextAction, 'submit_next');
  const deadline = deriveAnswerDeadlineView({ state: 'waiting', deadlineAt: 500 }, 200);
  assert.equal(deadline.remainingMs, 300);
  assert.equal(deadline.terminal, false);
});

test('Cycles 124-125: interrupt plan is immutable metadata and handoff excludes answer text', () => {
  const planner = new BatchPlanner();
  planner.add(envelope('q1', 1, 'Sensitive question')); planner.add(envelope('q2', 2, 'Latest sensitive question'));
  const plan = buildInterruptPlan(planner.snapshot(), 50);
  assert.equal(plan.latestId, 'q2');
  assert.deepEqual(plan.preservedIds, ['q1']);
  assert.equal(JSON.stringify(plan).includes('Sensitive question'), false);
  const handoff = buildAnswerHandoff({ batchId: 'b1', memberIds: ['q1'], answerState: { state: 'complete', elapsedMs: 80, wordCount: 20 }, proof: { verified: true } });
  assert.deepEqual(handoff, { batchId: 'b1', memberCount: 1, state: 'complete', reason: '', completedAt: handoff.completedAt, elapsedMs: 80, wordCount: 20, proofVerified: true, acknowledged: false });
  assert.equal('text' in handoff, false);
});

test('receiver runtime pauses after answer and preserves the next batch', async () => {
  const events = [];
  const runtime = createReceiverBatchRuntime({
    adapter: { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true },
    submitBatch: async batch => ({ ok: true, proof: { ok: true, verified: true, memberIds: batch.prompt.memberIds } }),
    onEvent: event => events.push(event),
    nowFn: (() => { let now = 100; return () => ++now; })()
  });
  runtime.setDeliveryPolicy({ pauseAfterAnswer: true });
  const first = await runtime.accept(envelope('q1', 1));
  await runtime.accept(envelope('q2', 2));
  const result = await runtime.answerComplete(first.batchId, { answerState: { state: 'complete' }, proof: { verified: true } });
  assert.equal(result.reason, 'pause_after_answer');
  assert.equal(runtime.snapshot().next.count, 1);
  assert.equal(events.some(event => event.type === 'post_answer_policy'), true);
});

test('receiver runtime requires an exact interrupt confirmation token', async () => {
  const runtime = createReceiverBatchRuntime({
    adapter: { provider: 'chatgpt', isGenerating: () => true, stopGenerating: () => true, setComposerText: () => true },
    submitBatch: async batch => ({ ok: true, proof: { ok: true, verified: true, memberIds: batch.prompt.memberIds } }),
    waitFn: async () => {}, interruptTimeoutMs: 25, interruptPollMs: 25
  });
  await runtime.accept(envelope('q1', 1));
  await runtime.accept(envelope('q2', 2));
  const refused = await runtime.interruptLatest('');
  assert.equal(refused.error, 'interrupt_confirmation_required');
  assert.equal(Boolean(refused.plan.token), true);
});
