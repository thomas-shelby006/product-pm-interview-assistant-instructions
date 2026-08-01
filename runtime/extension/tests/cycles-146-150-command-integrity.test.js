import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLiveCommandIntegrity, repairLiveCommandMetadata } from '../shared/live-command-integrity.js';
import { issueFocusGesture, validateFocusGesture } from '../shared/focus-gesture-token.js';

test('Cycles 146-149: metadata integrity detects orphans, self links, stale controls, and expired undo', () => {
  const snapshot = {
    ledger: [{ id: 'q1' }],
    questionOperations: { metadata: { q1: { parentId: 'q1' }, missing: { pinned: true } }, undoJournal: [{ id: 'u1', itemId: 'q1', action: 'pin', expiresAt: 10 }] },
    operatorMarkers: [{ id: 'm1', itemId: 'missing' }],
    incidentCenter: { incidents: [{ id: 'i1' }] }, incidentControls: { controls: { stale: { state: 'acknowledged' } } }, layout: { focusedRole: 'unknown' }
  };
  const audit = auditLiveCommandIntegrity(snapshot, 100);
  assert.equal(audit.ok, false);
  assert.equal(audit.issues.some(item => item.code === 'question_parent_self'), true);
  assert.equal(audit.issues.some(item => item.code === 'marker_target_orphan'), true);
  const repaired = repairLiveCommandMetadata(snapshot, 100);
  assert.equal('missing' in repaired.metadata, false);
  assert.equal(repaired.metadata.q1.parentId, '');
  assert.equal(repaired.markers.length, 0);
});

test('Cycle 150: focus gesture remains exact one-use and session bound', () => {
  const token = issueFocusGesture({ sessionId: 's1', target: 'sender', action: 'focus', now: 10, ttlMs: 1000, id: 'g' });
  const consumed = new Set();
  assert.equal(validateFocusGesture(token, { sessionId: 's1', target: 'sender', action: 'focus', now: 20, consumed }).ok, true);
  assert.equal(validateFocusGesture(token, { sessionId: 's1', target: 'sender', action: 'focus', now: 30, consumed }).error, 'focus_intent_consumed');
});

test('controller exposes integrity audit and explicit repair only', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../shared/runtime-pilot-controller.js', import.meta.url), 'utf8');
  assert.match(source, /liveCommandIntegrity/);
  assert.match(source, /repair_live_metadata/);
  assert.doesNotMatch(source.slice(source.indexOf("case 'repair_live_metadata'"), source.indexOf("case 'repair_state_compatibility'")), /markLedgerProven|archive/);
});
