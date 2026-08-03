import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAdaptiveTurnSafety } from '../shared/adaptive-turn-safety.js';
import { prepareSessionEnd, sessionEndCounts, validateSessionEnd } from '../shared/session-end-guard.js';
import { deriveProviderRouteTransition } from '../shared/provider-route-transition.js';
import { deriveProviderRouteReadiness } from '../shared/provider-route-readiness.js';
import { deriveReleaseHandoff } from '../shared/release-handoff.js';

function snapshot(turnCoordination = {}) {
  return {
    sessionId: 's',
    sender: { provider: 'chatgpt', connected: true, phase: 'ready', adapterCapabilities: { complete: true } },
    receiver: { provider: 'chatgpt', connected: true, phase: 'ready', composerReady: true, adapterCapabilities: { complete: true }, adapterCapabilityProbation: { writeSafe: true } },
    contextArmed: true,
    selfTest: { ok: true },
    ledger: [],
    ledgerCounts: { unresolved: 0, pending: 0, inFlight: 0 },
    batchState: { active: null, next: null, turnCoordination },
    liveSession: { phase: 'debrief' },
    senderOutboxState: { count: 0 }
  };
}

test('adaptive turn safety fails closed for pause, release, and interruption states', () => {
  for (const value of [
    { mode: 'paused_accumulating', pausedAt: 10, heldCount: 2 },
    { mode: 'resume_pending', heldCount: 1 },
    { mode: 'submitting', heldCount: 1 },
    { mode: 'live', interruption: { state: 'stop_pending', chainId: 'chain-1', memberIds: ['q1'] } }
  ]) {
    const safety = deriveAdaptiveTurnSafety(snapshot(value));
    assert.equal(safety.actionable, true);
    assert.equal(safety.blocksEnd, true);
    assert.equal(safety.blocksExport, true);
    assert.equal(safety.blocksRouteChange, true);
    assert.ok(safety.blockers.length >= 1);
  }
  assert.equal(deriveAdaptiveTurnSafety(snapshot({ mode: 'live', interruption: { state: 'resolved' } })).actionable, false);
});

test('session end counts and clean validation include actionable coordination', () => {
  const value = snapshot({ mode: 'paused_accumulating', heldCount: 2, heldMemberIds: ['q1', 'q2'] });
  const counts = sessionEndCounts(value);
  assert.equal(counts.adaptiveTurns, 2);
  const prepared = prepareSessionEnd(value, { now: 10, token: 'end-token' });
  assert.equal(prepared.canEnd, false);
  const clean = validateSessionEnd(prepared, { token: 'end-token', mode: 'clean', now: 20, currentCounts: prepared.counts });
  assert.equal(clean.ok, false);
  assert.equal(clean.error, 'adaptive_turns_actionable');
  const archived = validateSessionEnd(prepared, { token: 'end-token', mode: 'archive_and_end', now: 20, currentCounts: prepared.counts });
  assert.equal(archived.ok, true);
});
test('provider route and readiness freeze while adaptive coordination is actionable', () => {
  const value = snapshot({ mode: 'paused_accumulating', heldCount: 2 });
  const transition = deriveProviderRouteTransition(value, { sender: 'claude', receiver: 'chatgpt' });
  assert.equal(transition.state, 'freeze_required');
  assert.equal(transition.adaptiveSafety.actionable, true);
  assert.equal(transition.allowProviderWrite, false);
  const readiness = deriveProviderRouteReadiness({ ...value, routeTransition: transition });
  assert.equal(readiness.ready, false);
  assert.ok(readiness.blockers.includes('adaptive_turns_actionable'));
});

test('release handoff includes a coordination gate and blocks actionable export', () => {
  const value = snapshot({ mode: 'live', interruption: { state: 'stop_pending', chainId: 'chain-1', memberIds: ['q1'] } });
  const production = { diagnostics: { privacy: { safe: true }, state: 'healthy', score: 100, fingerprint: { commit: 'abc' } } };
  const evidence = { commit: 'abc', expectedCommit: 'abc', sourceClean: true, automatedOk: true, browserOk: true, assistUiOk: true, cleanupOk: true, noPushMergeTag: true };
  const handoff = deriveReleaseHandoff(value, production, evidence);
  const coordination = handoff.gates.find(item => item.id === 'coordination');
  assert.equal(coordination.ok, false);
  assert.equal(handoff.ready, false);
  assert.ok(handoff.failed.includes('coordination'));
});

test('safe coordination state does not block clean end, route readiness, or release', () => {
  const value = snapshot({ mode: 'live', heldCount: 0, interruption: { state: 'resolved' } });
  const safety = deriveAdaptiveTurnSafety(value);
  assert.equal(safety.actionable, false);
  const prepared = prepareSessionEnd(value, { now: 10, token: 'clean-token' });
  assert.equal(prepared.canEnd, true);
  const transition = deriveProviderRouteTransition(value, { sender: 'claude', receiver: 'chatgpt' });
  assert.equal(transition.state, 'ready_to_switch');
  const readiness = deriveProviderRouteReadiness({ ...value, routeTransition: transition });
  assert.equal(readiness.ready, true);
});
