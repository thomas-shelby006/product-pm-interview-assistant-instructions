import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOperationalEvent, filterOperationalEvents } from '../shared/operational-event-filter.js';
import { explainTrace } from '../shared/trace-explanation.js';
import { addSloSample, deriveSloTrend } from '../shared/slo-history.js';
import { advanceRunbook, buildStabilizationPlan, startRunbook } from '../shared/stabilization-runbook.js';
import { derivePerformanceHealth } from '../shared/performance-health.js';

test('Cycle 136: operational events are classified and filtered without mutating source', () => {
  const events = [{ type: 'batch_proof_failed', data: { reason: 'mismatch' } }, { type: 'heartbeat', data: {} }];
  assert.equal(classifyOperationalEvent(events[0]).group, 'delivery');
  assert.equal(classifyOperationalEvent(events[0]).severity, 'error');
  assert.equal(filterOperationalEvents(events, { group: 'system' }).length, 1);
  assert.equal('group' in events[0], false);
});

test('Cycle 137: trace explanation creates ordered plain-language stages', () => {
  const result = explainTrace({ traceId: 't', spans: [{ stage: 'proof', at: 20, state: 'complete' }, { stage: 'persisted', at: 10, state: 'complete' }] });
  assert.equal(result.steps[0].stage, 'persisted');
  assert.equal(result.state, 'delivered');
});

test('Cycle 138: SLO history is bounded, coalesced, and trend-aware', () => {
  let history = [];
  history = addSloSample(history, { deliveryForecast: { queued: 2, oldestAgeMs: 1000, p50Ms: 20, p95Ms: 30, proofsPerMinute: 2 } }, 100);
  history = addSloSample(history, { deliveryForecast: { queued: 2, oldestAgeMs: 1000, p50Ms: 20, p95Ms: 30, proofsPerMinute: 2 } }, 200);
  assert.equal(history.length, 1);
  history = addSloSample(history, { deliveryForecast: { queued: 1, oldestAgeMs: 500, p50Ms: 15, p95Ms: 25, proofsPerMinute: 2 } }, 60100);
  assert.equal(deriveSloTrend(history).state, 'recovering');
});

test('Cycle 139: stabilization runbook advances one verified step at a time', () => {
  const plan = buildStabilizationPlan({ rootCause: { code: 'sequence_gap' }, selfTest: { ok: false }, ledgerCounts: { persisted: 1 } });
  assert.equal(plan.some(step => step.id === 'reconcile'), true);
  let runbook = startRunbook({ rootCause: { code: 'sequence_gap' }, selfTest: { ok: false }, ledgerCounts: { persisted: 1 } }, 10);
  const before = runbook.current;
  runbook = advanceRunbook(runbook, { ok: true }, 20);
  assert.equal(runbook.current, before + 1);
});

test('Cycle 140: performance health separates watch conditions from user impact', () => {
  const watch = derivePerformanceHealth({ performanceBudget: { cacheHitRate: .4 }, storagePressure: { level: 'normal' } });
  assert.equal(watch.state, 'watch');
  assert.equal(watch.userImpact, false);
  const degraded = derivePerformanceHealth({ storagePressure: { level: 'critical' } });
  assert.equal(degraded.state, 'degraded');
  assert.equal(degraded.userImpact, true);
});

test('operational review source exposes SLO, runbook, health, and trace explanation', async () => {
  const { readFile } = await import('node:fs/promises');
  const controller = await readFile(new URL('../shared/runtime-pilot-controller.js', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');
  assert.match(controller, /operationalReview/);
  assert.match(controller, /start_stabilization/);
  assert.match(dashboard, /explainTrace/);
  assert.match(html, /id="operationalHealthState"/);
  assert.match(html, /id="stabilizationState"/);
});
