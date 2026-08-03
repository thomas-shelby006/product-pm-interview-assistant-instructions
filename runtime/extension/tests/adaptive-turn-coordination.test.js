import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTurnCoordination,
  transitionTurnCoordination,
  composeTurnCoordinatedPrompt,
  correlateSourceInterruption
} from '../shared/turn-coordination-state.js';
import { createReceiverBatchRuntime } from '../content/receiver-batch-runtime.js';
import { migrateRuntimeEnvelope } from '../shared/runtime-state-migrations.js';

function envelope(id, seq, text = `Question ${seq}`) {
  return { id, sessionId: 's', sourceProvider: 'chatgpt', kind: 'question', seq, text, metadata: {}, createdAt: seq };
}
test('pause is idempotent and persists only coordination metadata', () => {
  const paused = transitionTurnCoordination(normalizeTurnCoordination({}, 10), { type: 'pause', at: 20 });
  const repeated = transitionTurnCoordination(paused, { type: 'pause', at: 30 });
  assert.equal(paused.mode, 'paused_accumulating');
  assert.equal(repeated.pausedAt, 20);
  assert.equal(repeated.mode, 'paused_accumulating');
  assert.equal('heldMemberIds' in repeated, false);
});

test('paused prompt preserves every question and emphasizes the latest', () => {
  const state = transitionTurnCoordination({}, { type: 'pause', at: 20 });
  const prompt = composeTurnCoordinatedPrompt({
    entries: [envelope('q1', 1, 'First constraint'), envelope('q2', 2, 'Latest question')]
  }, state);
  assert.deepEqual(prompt.memberIds, ['q1', 'q2']);
  assert.match(prompt.text, /Forwarding was paused/i);
  assert.match(prompt.text, /First constraint/);
  assert.match(prompt.text, /LATEST ACTIONABLE QUESTION/i);
  assert.match(prompt.text, /Latest question/);
});
test('receiver pause keeps accepting finals and resume-and-send submits the frozen batch', async () => {
  const submitted = [];
  const adapter = { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true };
  const runtime = createReceiverBatchRuntime({
    adapter,
    submitBatch: async batch => { submitted.push(batch); return { ok: true, proof: { ok: true, verified: true } }; }
  });
  await runtime.pauseForwarding();
  const first = await runtime.accept(envelope('q1', 1, 'Context'));
  const second = await runtime.accept(envelope('q2', 2, 'Question'));
  assert.equal(first.reason, 'paused_accumulating');
  assert.equal(second.reason, 'paused_accumulating');
  assert.equal(submitted.length, 0);
  assert.equal(runtime.snapshot().turnCoordination.heldCount, 2);
  await runtime.resumeForwarding({ submit: true });
  assert.equal(submitted.length, 1);
  assert.deepEqual(submitted[0].prompt.memberIds, ['q1', 'q2']);
  assert.match(submitted[0].prompt.text, /Forwarding was paused/i);
});
test('resume without send leaves the exact held batch protected', async () => {
  let submitted = 0;
  const runtime = createReceiverBatchRuntime({
    adapter: { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true },
    submitBatch: async () => { submitted += 1; return { ok: true }; }
  });
  await runtime.pauseForwarding();
  await runtime.accept(envelope('q1', 1));
  const result = await runtime.resumeForwarding({ submit: false });
  assert.equal(result.reason, 'resumed_without_send');
  assert.equal(submitted, 0);
  assert.deepEqual(runtime.snapshot().next.prompt.memberIds, ['q1']);
  assert.equal(runtime.snapshot().turnCoordination.mode, 'live');
  assert.equal(runtime.snapshot().hold, true);
});

test('source interruption correlates only to an incomplete active source segment set', () => {
  const matched = correlateSourceInterruption({
    activeBatchMemberIds: ['q1'], sourceSegmentIds: ['q1'], sourceOutcome: 'interrupted', continuationId: 'q2', now: 50
  });
  assert.equal(matched.correlated, true);
  assert.deepEqual(matched.memberIds, ['q1', 'q2']);
  assert.equal(matched.state, 'stop_pending');
  const normal = correlateSourceInterruption({
    activeBatchMemberIds: ['q1'], sourceSegmentIds: ['q1'], sourceOutcome: 'complete', continuationId: 'q2', now: 50
  });
  assert.equal(normal.correlated, false);
});

test('receiver command surface routes forwarding pause and resume to coordinated batch ownership', async () => {
  const { readFile } = await import('node:fs/promises');
  const entry = await readFile(new URL('../content/entry.js', import.meta.url), 'utf8');
  const pauseAt = entry.indexOf("case 'pause_forwarding':");
  const resumeAt = entry.indexOf("case 'resume_forwarding':");
  assert.ok(pauseAt >= 0);
  assert.ok(resumeAt > pauseAt);
  const pauseBlock = entry.slice(pauseAt, resumeAt);
  assert.match(pauseBlock, /receiverBatchRuntime\.pauseForwarding\(\)/);
  assert.doesNotMatch(pauseBlock, /transportPaused\s*=\s*true/);
  const resumeBlock = entry.slice(resumeAt, entry.indexOf("case 'reconcile_delivery':", resumeAt));
  assert.match(resumeBlock, /receiverBatchRuntime\.resumeForwarding\(\{\s*submit:/);
});

test('schema v5 migration adds restart-safe coordination metadata without prompt text', () => {
  const migrated = migrateRuntimeEnvelope({
    schemaVersion: 4,
    writerVersion: '0.11.0',
    committedAt: 1,
    sessions: [{ sessionId: 's', batchState: { next: { memberIds: ['q1'] } } }]
  }, 5, { now: 100, writerVersion: '0.12.0' });
  assert.equal(migrated.ok, true);
  assert.equal(migrated.envelope.schemaVersion, 5);
  assert.equal(migrated.envelope.sessions[0].batchState.turnCoordination.mode, 'live');
  assert.equal(JSON.stringify(migrated.envelope).includes('question text'), false);
});
