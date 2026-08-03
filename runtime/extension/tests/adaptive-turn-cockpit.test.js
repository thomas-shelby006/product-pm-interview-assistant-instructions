import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deriveTurnCoordinationCockpit } from '../dashboard/turn-coordination-model.js';

function snapshot(turnCoordination = {}, extra = {}) {
  return {
    batchState: {
      active: null,
      next: null,
      autoSubmit: true,
      draftConflict: null,
      turnCoordination,
      ...(extra.batchState || {})
    },
    metrics: extra.metrics || {},
    ...extra
  };
}

test('turn coordination cockpit derives live paused carryover blocked and recovered states', () => {
  const live = deriveTurnCoordinationCockpit(snapshot({ mode: 'live' }), 100);
  assert.equal(live.state, 'live');
  assert.equal(live.primary.command, 'pause');
  assert.equal(live.secondary, null);

  const paused = deriveTurnCoordinationCockpit(snapshot({ mode: 'paused_accumulating', pausedAt: 50, heldCount: 2, heldMemberIds: ['q1', 'q2'] }), 100);
  assert.equal(paused.state, 'paused');
  assert.equal(paused.heldCount, 2);
  assert.equal(paused.primary.command, 'resume_catch_up');
  assert.equal(paused.secondary.command, 'resume_without_send');
  assert.match(paused.detail, /2 protected/);

  const carryover = deriveTurnCoordinationCockpit(snapshot({
    mode: 'live',
    interruption: { state: 'stop_pending', chainId: 'chain-1', memberIds: ['q1', 'q2'], reason: 'source_answer_interrupted' }
  }), 100);
  assert.equal(carryover.state, 'carryover');
  assert.equal(carryover.carryoverCount, 2);
  assert.equal(carryover.primary.command, 'check_live');

  const blocked = deriveTurnCoordinationCockpit(snapshot({ mode: 'paused_accumulating', heldCount: 1 }, {
    batchState: { draftConflict: { state: 'unresolved', owner: 'manual' } }
  }), 100);
  assert.equal(blocked.state, 'blocked');
  assert.equal(blocked.primary.command, 'resolve_draft_restore_pmia');

  const recovered = deriveTurnCoordinationCockpit(snapshot({
    mode: 'live',
    interruption: { state: 'resolved', chainId: 'chain-1', memberIds: ['q1', 'q2'], reason: 'source_answer_interrupted' }
  }), 100);
  assert.equal(recovered.state, 'recovered');
  assert.equal(recovered.primary.command, 'pause');
});

test('cockpit reports bounded metadata-only latency throughput and counts', () => {
  const model = deriveTurnCoordinationCockpit(snapshot({ mode: 'paused_accumulating', heldCount: 3 }, {
    batchState: { active: { memberIds: ['q0'] }, next: { memberIds: ['q1', 'q2', 'q3'] } },
    turnPerformance: {
      state: 'healthy', p50Ms: 90, p95Ms: 180, maxMs: 210,
      sampleCount: 12, staleCount: 0, dominantStage: 'resume_submit',
      stages: { resume_submit: { p95Ms: 180, budgetMs: 200, state: 'healthy' } },
      throughput: { admittedLastMinute: 20, turnsPerMinute: 20, targetPerMinute: 20, targetMet: true }
    }
  }), 1000);
  assert.equal(model.activeCount, 1);
  assert.equal(model.heldCount, 3);
  assert.equal(model.latency.p95Ms, 180);
  assert.equal(model.latency.sampleCount, 12);
  assert.equal(model.latency.dominantStage, 'resume_submit');
  assert.equal(model.latency.throughput.targetMet, true);
  assert.equal(model.latency.throughput.turnsPerMinute, 20);
  assert.doesNotMatch(JSON.stringify(model), /question text|answer text/i);
});

test('dashboard packages one accessible Turn Coordination card and existing commands', async () => {
  const root = new URL('../dashboard/', import.meta.url);
  const [markup, source, renderer, css] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('dashboard.js', root), 'utf8'),
    readFile(new URL('render-turn-coordination.js', root), 'utf8'),
    readFile(new URL('dashboard.css', root), 'utf8')
  ]);
  for (const id of [
    'turnCoordinationPanel', 'turnCoordinationState', 'turnCoordinationTitle',
    'turnCoordinationDetail', 'turnCoordinationHeld', 'turnCoordinationActive',
    'turnCoordinationLatency', 'turnCoordinationPrimary', 'turnCoordinationSecondary'
  ]) {
    assert.equal((markup.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `${id} must be unique`);
  }
  assert.match(markup, /aria-live="polite"/);
  assert.match(source, /renderTurnCoordination/);
  assert.match(renderer, /deriveTurnCoordinationCockpit/);
  assert.match(markup, /data-command="pause"/);
  assert.match(markup, /data-command="resume_without_send"/);
  assert.match(css, /\.turn-coordination-actions/);
  assert.match(css, /@media \(max-width: 320px\)/);
  assert.match(css, /@media print/);
});
