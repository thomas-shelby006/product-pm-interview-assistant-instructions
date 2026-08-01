import test from 'node:test';
import assert from 'node:assert/strict';
import { addOperatorMarker, markerSummary } from '../shared/operator-markers.js';
import { deriveActivityMarkers } from '../shared/activity-markers.js';
import { deriveSessionCheckpoint } from '../shared/session-checkpoint.js';
import { deriveInterruptionRecoveryCard } from '../shared/interruption-recovery-card.js';
import { deriveSessionLandmarks } from '../shared/session-landmarks.js';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';

test('Cycle 116 operator markers remain bounded metadata references', () => {
  let markers = [];
  for (let index = 0; index < 140; index += 1) markers = addOperatorMarker(markers, { id: `m${index}`, category: 'needs_review', targetType: 'envelope', targetId: `q${index}`, createdAt: index });
  assert.equal(markers.length, 100);
  assert.equal(markerSummary(markers).counts.needs_review, 100);
  assert.doesNotMatch(JSON.stringify(markers), /prompt|answer|text/);
});

test('Cycle 117 activity markers are deduplicated projections of safe timeline events', () => {
  const markers = deriveActivityMarkers([
    { type: 'final_persisted', at: 1000, data: { envelopeId: 'q1' } },
    { type: 'final_persisted', at: 1001, data: { envelopeId: 'q1' } },
    { type: 'answer_terminal', at: 2000, data: { batchId: 'b1' } }
  ]);
  assert.equal(markers.length, 2);
  assert.deepEqual(markers.map(item => item.category), ['question_arrived', 'answer_completed']);
});

test('Cycle 118 checkpoint preserves phase batch clock and unresolved identity only', () => {
  const checkpoint = deriveSessionCheckpoint({
    sessionId: 's1', mode: 'active', liveSession: { phase: 'active', startedAt: 10, pausedTotalMs: 5 },
    ledger: [{ id: 'q1', state: 'persisted', envelope: { text: 'private' } }],
    batchState: { active: { id: 'b1', memberIds: ['q1'] }, next: { id: 'b2', memberIds: ['q2'] } }
  }, 100, 'test');
  assert.equal(checkpoint.activeBatchId, 'b1');
  assert.deepEqual(checkpoint.nextMemberIds, ['q2']);
  assert.equal(checkpoint.unresolvedCount, 1);
  assert.doesNotMatch(JSON.stringify(checkpoint), /private|text/);
});

test('Cycle 119 interruption recovery exposes one current safe step', () => {
  const checkpoint = deriveSessionCheckpoint({ sessionId: 's1', mode: 'active', liveSession: { phase: 'active' }, ledger: [] }, 100);
  const card = deriveInterruptionRecoveryCard({
    mode: 'degraded', liveSession: { phase: 'active' }, sender: { connected: false }, receiver: { connected: true },
    selfTest: { ok: false }, consistencyAudit: { ok: false }, checkpoint
  }, checkpoint, 200);
  assert.equal(card.visible, true);
  assert.equal(card.current.command, 'check_live');
});

test('Cycle 120 landmarks merge timeline operator and activity metadata in time order', () => {
  const values = deriveSessionLandmarks({
    timeline: [{ type: 'live_session_phase', at: 30, data: { phase: 'active' } }],
    operatorMarkers: [{ id: 'm1', category: 'needs_review', createdAt: 20, targetType: 'session', targetId: '', source: 'operator' }],
    activityMarkers: [{ id: 'a1', category: 'question_arrived', createdAt: 10, targetType: 'event', targetId: 'q1', source: 'runtime' }]
  });
  assert.deepEqual(values.map(item => item.id), ['a1', 'm1', 'timeline:live_session_phase:30:0']);
});

test('operator markers and checkpoint survive state export and restore', () => {
  const state = new RuntimePilotState([{ sessionId: 's1' }]);
  state.addOperatorMarker('s1', { category: 'needs_review', targetType: 'session', targetId: 's1' }, 10);
  state.setCheckpoint('s1', { id: 'cp1', createdAt: 11, phase: 'active', mode: 'active' }, 11);
  const restored = new RuntimePilotState(state.exportState()).snapshot('s1', 12);
  assert.equal(restored.operatorMarkers.length, 1);
  assert.equal(restored.checkpoint.id, 'cp1');
});
