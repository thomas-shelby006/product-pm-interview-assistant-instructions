import test from 'node:test';
import assert from 'node:assert/strict';
import { BatchPlanner } from '../shared/batch-planner.js';
import { createReceiverBatchRuntime } from '../content/receiver-batch-runtime.js';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';
import { safeBatchTelemetry } from '../shared/batch-event-policy.js';
import { buildRenderedProofIndex } from '../shared/proof-reconciliation-index.js';
import { buildReconciliationPayload } from '../shared/delivery-reconciler.js';

function envelope(id, seq, text = `Question ${seq}`, metadata = {}) {
  return { id, sessionId: 's', sourceProvider: 'chatgpt', kind: 'question', seq, text, metadata, createdAt: seq };
}

test('receiver reload restores paused members and resumes one exact combined submission', async () => {
  const first = createReceiverBatchRuntime({
    adapter: { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true },
    submitBatch: async () => ({ ok: true })
  });
  await first.pauseForwarding();
  await first.accept(envelope('q1', 1));
  await first.accept(envelope('q2', 2));
  const checkpoint = first.snapshot();

  const submitted = [];
  const restored = createReceiverBatchRuntime({
    planner: new BatchPlanner(checkpoint),
    turnCoordinationState: checkpoint.turnCoordination,
    adapter: { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true },
    submitBatch: async batch => { submitted.push(batch); return { ok: true, proof: { ok: true, verified: true } }; }
  });
  assert.equal(restored.snapshot().turnCoordination.mode, 'paused_accumulating');
  assert.equal(restored.snapshot().hold, true);
  await restored.accept(envelope('q3', 3));
  assert.equal(submitted.length, 0);
  await restored.resumeForwarding({ submit: true });
  assert.equal(submitted.length, 1);
  assert.deepEqual(submitted[0].prompt.memberIds, ['q1', 'q2', 'q3']);
});

test('Pilot export and restore preserves actionable coordination metadata without text', () => {
  const pilot = new RuntimePilotState([], { nowFn: () => 100 });
  pilot.ensure('s');
  pilot.updateBatchState('s', {
    type: 'forwarding_paused',
    turnCoordination: {
      version: 1,
      mode: 'paused_accumulating',
      pausedAt: 90,
      updatedAt: 90,
      interruption: { state: 'stop_pending', chainId: 'chain-1', memberIds: ['q1'], reason: 'source_answer_interrupted' }
    }
  }, 100);
  const exported = pilot.exportState();
  const restored = new RuntimePilotState(exported, { nowFn: () => 120 });
  const value = restored.snapshot('s').batchState.turnCoordination;
  assert.equal(value.mode, 'paused_accumulating');
  assert.equal(value.interruption.chainId, 'chain-1');
  assert.equal(JSON.stringify(value).includes('Question text'), false);
});
test('hidden Stop watchdog uses bounded wake attempts and preserves ownership on timeout', async () => {
  let stopCalls = 0;
  let wakes = 0;
  const runtime = createReceiverBatchRuntime({
    adapter: {
      provider: 'chatgpt',
      isGenerating: () => true,
      stopGenerating: () => { stopCalls += 1; return true; },
      setComposerText: () => true
    },
    submitBatch: async () => ({ ok: true, proof: { ok: true, verified: true } }),
    waitFn: async () => { wakes += 1; },
    interruptTimeoutMs: 30,
    interruptPollMs: 10
  });
  // Restore a submitted active batch without invoking another provider write.
  const planner = runtime.planner;
  planner.add(envelope('q1', 1, 'Original', { sourceTurnId: 'turn-1' }));
  planner.freezeNext(1);
  planner.markSubmitted(2);
  planner.add(envelope('q2', 2, 'Continuation', { continuationOf: 'turn-1' }));
  const before = runtime.snapshot();
  const result = await runtime.carryoverInterruption({
    activeBatchId: before.active.id,
    sourceSegmentIds: ['q1'],
    sourceOutcome: 'interrupted',
    continuationId: 'q2',
    generationToken: 'hidden-timeout'
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'stop_timeout');
  assert.equal(stopCalls, 1);
  assert.equal(wakes, 3);
  assert.deepEqual(runtime.snapshot().active.prompt.memberIds, ['q1']);
  assert.deepEqual(runtime.snapshot().next.prompt.memberIds, ['q2']);
});

test('concurrent Resume calls freeze and submit the held batch once', async () => {
  let submissions = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const runtime = createReceiverBatchRuntime({
    adapter: { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true },
    submitBatch: async () => { submissions += 1; await gate; return { ok: true, proof: { ok: true, verified: true } }; }
  });
  await runtime.pauseForwarding();
  await runtime.accept(envelope('q1', 1));
  const first = runtime.resumeForwarding({ submit: true });
  const second = runtime.resumeForwarding({ submit: true });
  await Promise.resolve();
  assert.equal(submissions, 1);
  release();
  const results = await Promise.all([first, second]);
  assert.equal(results.every(result => result.ok !== false), true);
  assert.equal(submissions, 1);
});

test('carryover proof cannot be satisfied by the old single-member prompt', () => {
  const planner = new BatchPlanner();
  planner.add(envelope('q1', 1, 'Original'));
  const oldBatch = planner.freezeNext(1);
  planner.add(envelope('q2', 2, 'Continuation'));
  const carried = planner.createCarryover(2, { activeBatchId: oldBatch.id, continuationIds: ['q2'] });
  assert.equal(carried.ok, true);
  const oldIndex = buildRenderedProofIndex([{ id: 'render-old', role: 'user', text: oldBatch.prompt.text }]);
  assert.equal(oldIndex.matches(carried.batch.prompt), false);
  const currentIndex = buildRenderedProofIndex([{ id: 'render-new', role: 'user', text: carried.batch.prompt.text }]);
  assert.equal(currentIndex.matches(carried.batch.prompt), true);
});

test('safe batch telemetry exposes coordination identities but excludes transcript text', () => {
  const value = safeBatchTelemetry({
    active: null,
    next: { entries: [] },
    turnCoordination: {
      version: 1,
      mode: 'paused_accumulating',
      pausedAt: 10,
      interruption: { state: 'stop_pending', chainId: 'chain-1', memberIds: ['q1'], reason: 'source_answer_interrupted' },
      forbiddenText: 'Sensitive question text'
    }
  });
  assert.equal(value.turnCoordination.mode, 'paused_accumulating');
  assert.deepEqual(value.turnCoordination.interruption.memberIds, ['q1']);
  assert.equal(JSON.stringify(value).includes('Sensitive question text'), false);
});

test('reconciliation carries paused coordination before replaying unresolved envelopes', () => {
  const payload = buildReconciliationPayload({
    batchState: {
      hold: true,
      autoSubmit: true,
      turnCoordination: {
        mode: 'paused_accumulating',
        pausedAt: 50,
        updatedAt: 50,
        interruption: { state: 'none', memberIds: [] }
      }
    },
    ledger: [{
      id: 'q1',
      state: 'persisted',
      persistedAt: 60,
      envelope: envelope('q1', 1, 'Sensitive question text')
    }]
  });
  assert.equal(payload.turnCoordination.mode, 'paused_accumulating');
  assert.equal(payload.hold, true);
  assert.equal(payload.autoSubmit, true);
  assert.equal(JSON.stringify(payload.turnCoordination).includes('Sensitive question text'), false);
  assert.deepEqual(payload.pending.map(item => item.id), ['q1']);
});
test('fresh receiver applies paused reconciliation state before pending replay', async () => {
  const payload = buildReconciliationPayload({
    batchState: {
      hold: true,
      autoSubmit: true,
      turnCoordination: { mode: 'paused_accumulating', pausedAt: 50, updatedAt: 50 }
    },
    ledger: [{ id: 'q1', state: 'persisted', persistedAt: 60, envelope: envelope('q1', 1) }]
  });
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true },
    submitBatch: async batch => { submitted.push(batch); return { ok: true, proof: { verified: true } }; }
  });
  const reconciled = await runtime.reconcile(payload);
  assert.equal(reconciled.ok, true);
  assert.equal(submitted.length, 0);
  assert.equal(runtime.snapshot().turnCoordination.mode, 'paused_accumulating');
  assert.equal(runtime.snapshot().hold, true);
  assert.deepEqual(runtime.snapshot().next.prompt.memberIds, ['q1']);
  await runtime.resumeForwarding({ submit: true });
  assert.equal(submitted.length, 1);
  assert.deepEqual(submitted[0].prompt.memberIds, ['q1']);
});