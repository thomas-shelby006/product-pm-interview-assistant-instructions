import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createReceiverBatchRuntime } from '../content/receiver-batch-runtime.js';
import { normalizeDashboardCommand } from '../shared/dashboard-protocol.js';
import { buildPolicyImpactPreview } from '../shared/policy-impact-preview.js';

function envelope(id, seq, metadata = {}) {
  return { id, sessionId: 's', sourceProvider: 'chatgpt', kind: 'question', seq, text: `Question ${seq}`, metadata, createdAt: seq };
}

test('coordination policy persists without changing pause or submitting', async () => {
  let submissions = 0;
  const runtime = createReceiverBatchRuntime({
    adapter: { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true },
    submitBatch: async () => { submissions += 1; return { ok: true }; }
  });
  await runtime.pauseForwarding();
  await runtime.accept(envelope('q1', 1));
  const result = runtime.setCoordinationPolicy('conservative');
  assert.equal(result.ok, true);
  assert.equal(runtime.snapshot().turnCoordination.policy, 'conservative');
  assert.equal(runtime.snapshot().turnCoordination.mode, 'paused_accumulating');
  assert.equal(submissions, 0);
  assert.equal(runtime.setCoordinationPolicy('unsafe').ok, false);
});

test('manual policy accumulates exact continuations without automatic Stop', async () => {
  let generating = false;
  let stops = 0;
  const runtime = createReceiverBatchRuntime({
    adapter: {
      provider: 'chatgpt', isGenerating: () => generating,
      stopGenerating: () => { stops += 1; generating = false; return true; },
      setComposerText: () => true
    },
    submitBatch: async () => { generating = true; return { ok: true, proof: { verified: true } }; }
  });
  runtime.setCoordinationPolicy('manual');
  await runtime.accept(envelope('q1', 1, { sourceTurnId: 'turn-1' }));
  const result = await runtime.accept(envelope('q2', 2, { sourceTurnId: 'turn-1', continuationOf: 'turn-1', revisionOf: 'q1', sourceOutcome: 'interrupted' }));
  assert.equal(stops, 0);
  assert.equal(result.reason, 'receiver_busy');
  assert.deepEqual(runtime.snapshot().next.prompt.memberIds, ['q2']);
});
test('dashboard policy command accepts only previewed supported presets', () => {
  const snapshot = { sessionId:'s', batchState:{ turnCoordination:{ policy:'adaptive', mode:'live', heldCount:0 } }, ledgerCounts:{ unresolved:0 } };
  const base = { sessionId: 's', requestId: 'r', command: 'set_turn_coordination_policy' };
  const adaptive = buildPolicyImpactPreview(snapshot, { kind:'turn_coordination', policy:'adaptive' }, 100);
  const manual = buildPolicyImpactPreview(snapshot, { kind:'turn_coordination', policy:'manual' }, 100);
  assert.equal(normalizeDashboardCommand({ ...base, payload: { policy: 'adaptive', preview:adaptive } }).payload.policy, 'adaptive');
  assert.equal(normalizeDashboardCommand({ ...base, requestId: 'r2', payload: { policy: 'manual', preview:manual } }).payload.policy, 'manual');
  assert.equal(normalizeDashboardCommand({ ...base, requestId: 'r3', payload: { policy: 'unsafe', preview:manual } }), null);
  assert.equal(normalizeDashboardCommand({ ...base, requestId: 'r4', payload: { policy: 'manual' } }), null);
});

test('Pilot controller routes coordination controls only to the receiver owner', async () => {
  const source = await readFile(new URL('../shared/runtime-pilot-controller.js', import.meta.url), 'utf8');
  assert.match(source, /case 'set_turn_coordination_policy'[\s\S]*sendRuntimeCommand\(registry, sessionId, 'receiver', 'set_turn_coordination_policy'/);
  assert.match(source, /case 'send_held_now'[\s\S]*sendRuntimeCommand\(registry, sessionId, 'receiver', 'send_held_now'/);
  assert.match(source, /case 'keep_accumulating'[\s\S]*sendRuntimeCommand\(registry, sessionId, 'receiver', 'keep_accumulating'/);
});