import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTurnCoordinationPerformance,
  recordTurnCoordinationSample,
  deriveTurnCoordinationPerformance
} from '../shared/turn-coordination-performance.js';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';
import { createReceiverBatchRuntime } from '../content/receiver-batch-runtime.js';
import { buildSafeSupportBundle } from '../shared/support-bundle.js';

function sample(stage, id, startedAt, completedAt, extra = {}) {
  return { stage, correlationId: id, startedAt, completedAt, ...extra };
}

test('coordination performance records bounded metadata-only stage samples', () => {
  let value = createTurnCoordinationPerformance();
  value = recordTurnCoordinationSample(value, sample(
    'observe_persist', 'q1', 100, 160,
    { memberCount: 1, questionText: 'SECRET QUESTION', answerText: 'SECRET ANSWER' }
  ));
  assert.equal(value.samples.length, 1);
  assert.equal(value.samples[0].durationMs, 60);
  assert.equal(value.samples[0].memberCount, 1);
  assert.doesNotMatch(JSON.stringify(value), /SECRET QUESTION|SECRET ANSWER/);
});

test('duplicate stage correlation preserves the first completed sample', () => {
  let value = createTurnCoordinationPerformance();
  value = recordTurnCoordinationSample(value, sample('persist_stage', 'q1', 100, 180));
  value = recordTurnCoordinationSample(value, sample('persist_stage', 'q1', 100, 170));
  assert.equal(value.samples.length, 1);
  assert.equal(value.samples[0].durationMs, 80);
});

test('scorecard applies per-stage p50 p95 and budget thresholds', () => {
  let value = createTurnCoordinationPerformance();
  for (const duration of [40, 60, 80, 100, 140]) {
    value = recordTurnCoordinationSample(value, sample(
      'observe_persist', `q-${duration}`, 1000, 1000 + duration
    ));
  }
  const report = deriveTurnCoordinationPerformance(value, 1200);
  assert.equal(report.stages.observe_persist.p50Ms, 80);
  assert.equal(report.stages.observe_persist.p95Ms, 140);
  assert.equal(report.stages.observe_persist.state, 'healthy');
  assert.equal(report.dominantStage, 'observe_persist');
});

test('stale samples are reported but excluded from current health', () => {
  let value = createTurnCoordinationPerformance();
  value = recordTurnCoordinationSample(value, sample('resume_submit', 'old', 0, 400));
  const report = deriveTurnCoordinationPerformance(value, 1_000_000, { staleAfterMs: 60_000 });
  assert.equal(report.stages.resume_submit.sampleCount, 0);
  assert.equal(report.stages.resume_submit.staleCount, 1);
  assert.equal(report.stages.resume_submit.state, 'stale');
});

test('twenty distinct observed finals inside one minute satisfy throughput target', () => {
  let value = createTurnCoordinationPerformance();
  for (let index = 0; index < 20; index += 1) {
    value = recordTurnCoordinationSample(value, sample(
      'observe_persist', `q${index + 1}`, index * 1000, index * 1000 + 40,
      { sequence: index + 1 }
    ));
  }
  const report = deriveTurnCoordinationPerformance(value, 20_000);
  assert.equal(report.throughput.admittedLastMinute, 20);
  assert.equal(report.throughput.turnsPerMinute, 20);
  assert.equal(report.throughput.targetMet, true);
  assert.deepEqual(report.throughput.sequences, Array.from({ length: 20 }, (_, i) => i + 1));
});

test('one hundred turn burst remains bounded ordered and lossless', () => {
  let value = createTurnCoordinationPerformance();
  for (let index = 0; index < 100; index += 1) {
    value = recordTurnCoordinationSample(value, sample(
      'observe_persist', `burst-${index + 1}`, 10_000 + index, 10_010 + index,
      { sequence: index + 1 }
    ));
  }
  const report = deriveTurnCoordinationPerformance(value, 11_000);
  assert.equal(value.samples.length, 100);
  assert.equal(report.throughput.admittedLastMinute, 100);
  assert.equal(report.throughput.uniqueCount, 100);
  assert.deepEqual(report.throughput.sequences, Array.from({ length: 100 }, (_, i) => i + 1));
  assert.equal(report.contentFree, true);
});

test('invalid stages and negative durations are rejected', () => {
  let value = createTurnCoordinationPerformance();
  value = recordTurnCoordinationSample(value, sample('unknown', 'q1', 10, 20));
  value = recordTurnCoordinationSample(value, sample('stop_resubmit', 'q2', 30, 20));
  assert.equal(value.samples.length, 0);
});

test('Runtime Pilot persists samples and derives the current scorecard', () => {
  const pilot = new RuntimePilotState([], { nowFn: () => 1000 });
  pilot.recordTurnCoordinationSample('s', sample('observe_persist', 'q1', 100, 160, { sequence: 1 }), 160);
  pilot.recordTurnCoordinationSample('s', sample('persist_stage', 'q1', 160, 220, { sequence: 1 }), 220);
  const snapshot = pilot.snapshot('s', 230);
  assert.equal(snapshot.turnPerformance.stages.observe_persist.p95Ms, 60);
  assert.equal(snapshot.turnPerformance.stages.persist_stage.p95Ms, 60);
  assert.equal(snapshot.metrics.turnCoordination.samples.length, 2);
  const restored = new RuntimePilotState(pilot.exportState(), { nowFn: () => 240 });
  assert.equal(restored.snapshot('s', 240).turnPerformance.sampleCount, 2);
});

function envelope(id, seq, metadata = {}) {
  return {
    id,
    sessionId: 's',
    sourceProvider: 'chatgpt',
    kind: 'question',
    seq,
    text: `Question ${seq}`,
    metadata,
    createdAt: seq
  };
}

test('receiver emits resume-to-submit latency on the actual submitting event', async () => {
  let clock = 100;
  const events = [];
  const runtime = createReceiverBatchRuntime({
    adapter: { provider: 'chatgpt', isGenerating: () => false, setComposerText: () => true },
    submitBatch: async () => ({ ok: true, proof: { ok: true, verified: true } }),
    onEvent: event => events.push(event),
    nowFn: () => ++clock
  });
  await runtime.pauseForwarding();
  await runtime.accept(envelope('q1', 1));
  await runtime.resumeForwarding({ submit: true });
  const event = events.find(item => item.type === 'batch_submitting' && item.coordinationLatency?.stage === 'resume_submit');
  assert.ok(event);
  assert.equal(event.coordinationLatency.correlationId, event.batchId);
  assert.ok(event.coordinationLatency.completedAt >= event.coordinationLatency.startedAt);
});

test('receiver emits stop-to-resubmit latency for a successful carryover', async () => {
  let clock = 200;
  let generating = false;
  const events = [];
  const runtime = createReceiverBatchRuntime({
    adapter: {
      provider: 'chatgpt',
      isGenerating: () => generating,
      stopGenerating: () => { generating = false; return true; },
      setComposerText: () => true
    },
    submitBatch: async () => ({ ok: true, proof: { ok: true, verified: true } }),
    onEvent: event => events.push(event),
    nowFn: () => ++clock,
    waitFn: async () => {}
  });
  await runtime.accept(envelope('q1', 1, { sourceTurnId: 'turn-1' }));
  generating = true;
  await runtime.accept(envelope('q2', 2));
  const activeBatchId = runtime.snapshot().active.id;
  const result = await runtime.carryoverInterruption({
    activeBatchId,
    sourceSegmentIds: ['q1'],
    sourceOutcome: 'interrupted',
    continuationId: 'q2',
    generationToken: 'generation-1'
  });
  assert.equal(result.ok, true);
  const event = events.find(item => item.type === 'batch_submitting' && item.coordinationLatency?.stage === 'stop_resubmit');
  assert.ok(event);
  assert.equal(event.coordinationLatency.correlationId, result.correlation.chainId);
  assert.ok(event.coordinationLatency.memberCount >= 2);
});

test('safe support bundle exports derived turn performance without sample content', () => {
  let value = createTurnCoordinationPerformance();
  value = recordTurnCoordinationSample(value, sample('observe_persist', 'q1', 100, 150, {
    sequence: 1, questionText: 'SECRET QUESTION'
  }));
  const turnPerformance = deriveTurnCoordinationPerformance(value, 200);
  const bundle = buildSafeSupportBundle({
    sessionId: 's', mode: 'active', ledger: [], ledgerCounts: {},
    sender: {}, receiver: {}, turnPerformance
  });
  assert.equal(bundle.turnPerformance.stages.observe_persist.p95Ms, 50);
  assert.equal(bundle.turnPerformance.throughput.admittedLastMinute, 1);
  assert.equal(bundle.turnPerformance.contentFree, true);
  assert.doesNotMatch(JSON.stringify(bundle), /SECRET QUESTION|questionText/);
});
