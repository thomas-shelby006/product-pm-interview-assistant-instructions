import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiverBatchRuntime } from '../content/receiver-batch-runtime.js';

function envelope(id, seq, text, metadata = {}) {
  return { id, sessionId: 's', sourceProvider: 'chatgpt', kind: 'question', seq, text, metadata, createdAt: seq };
}

function runtimeHarness() {
  let generating = false;
  let stopAllowed = false;
  const submitted = [];
  const runtime = createReceiverBatchRuntime({
    adapter: {
      provider: 'chatgpt',
      isGenerating: () => generating,
      stopGenerating: () => {
        if (!stopAllowed) return false;
        generating = false;
        return true;
      },
      setComposerText: () => true
    },
    submitBatch: async batch => {
      submitted.push(batch.prompt.memberIds);
      generating = true;
      return { ok: true, proof: { ok: true, verified: true } };
    },
    cancelActiveAnswer: async () => ({ ok: true }),
    waitFn: async () => {}
  });
  return { runtime, submitted, allowStop: () => { stopAllowed = true; }, isGenerating: () => generating };
}
test('Stop failure persists one metadata-only carryover recovery chain', async () => {
  const { runtime } = runtimeHarness();
  await runtime.accept(envelope('q1', 1, 'Sensitive original', { sourceTurnId: 'turn-1' }));
  const result = await runtime.accept(envelope('q2', 2, 'Sensitive revision', {
    sourceTurnId: 'turn-1', continuationOf: 'turn-1', revisionOf: 'q1', boundary: 'rendered_user_turn_revision',
    sourceOutcome: 'interrupted', generationToken: 'g-fail'
  }));
  assert.equal(result.reason, 'carryover_stop_failed');
  const coordination = runtime.snapshot().turnCoordination;
  assert.equal(coordination.interruption.state, 'recovery_required');
  assert.deepEqual(coordination.interruption.memberIds, ['q1', 'q2']);
  assert.equal(coordination.interruption.continuationId, 'q2');
  assert.equal(coordination.interruption.failureReason, 'stop_failed');
  assert.doesNotMatch(JSON.stringify(coordination), /Sensitive original|Sensitive revision/);
});

test('Retry carryover reuses exact members after Stop becomes available', async () => {
  const { runtime, submitted, allowStop } = runtimeHarness();
  await runtime.accept(envelope('q1', 1, 'Original', { sourceTurnId: 'turn-1' }));
  await runtime.accept(envelope('q2', 2, 'Revision', {
    sourceTurnId: 'turn-1', continuationOf: 'turn-1', revisionOf: 'q1', boundary: 'rendered_user_turn_revision',
    sourceOutcome: 'interrupted', generationToken: 'g-retry'
  }));
  allowStop();
  const retried = await runtime.retryCarryover();
  assert.equal(retried.ok, true);
  assert.deepEqual(submitted, [['q1'], ['q1', 'q2']]);
  assert.equal(runtime.snapshot().turnCoordination.interruption.state, 'resolved');
});
test('Keep accumulating clears forced interruption and preserves both batches', async () => {
  const { runtime, submitted } = runtimeHarness();
  await runtime.accept(envelope('q1', 1, 'Original', { sourceTurnId: 'turn-1' }));
  await runtime.accept(envelope('q2', 2, 'Revision', {
    sourceTurnId: 'turn-1', continuationOf: 'turn-1', revisionOf: 'q1', boundary: 'rendered_user_turn_revision',
    sourceOutcome: 'interrupted', generationToken: 'g-hold'
  }));
  const kept = await runtime.keepAccumulating();
  assert.equal(kept.ok, true);
  const snapshot = runtime.snapshot();
  assert.equal(snapshot.turnCoordination.mode, 'paused_accumulating');
  assert.equal(snapshot.turnCoordination.interruption.state, 'resolved');
  assert.equal(snapshot.hold, true);
  assert.deepEqual(snapshot.active.prompt.memberIds, ['q1']);
  assert.deepEqual(snapshot.next.prompt.memberIds, ['q2']);
  assert.deepEqual(submitted, [['q1']]);
});
