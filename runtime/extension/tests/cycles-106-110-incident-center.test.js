import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveIncidents, mergeIncidentState, updateIncidentControl } from '../shared/incident-center.js';
import { deriveIncidentRunbook } from '../shared/incident-runbook.js';
import { deriveQuietAttention } from '../shared/quiet-attention-policy.js';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';

test('Cycle 106 incident center merges one owner/code/role incident and orders severity', () => {
  const derived = deriveIncidents({
    warnings: [{ code: 'sender_missing', role: 'sender', severity: 'error' }],
    rootCause: { owner: 'transport', code: 'transport_unavailable', severity: 'critical', nextAction: 'repair_runtime' }
  }, 100);
  assert.equal(derived[0].code, 'transport_unavailable');
  assert.equal(derived[1].role, 'sender');
});

test('Cycle 107 acknowledgement and snooze persist as metadata and escalation reopens', () => {
  const base = [{ id: 'runtime:x:', owner: 'runtime', code: 'x', role: '', severity: 'warn', firstSeenAt: 1, lastSeenAt: 1, occurrences: 1 }];
  let controls = updateIncidentControl({}, 'runtime:x:', 'acknowledge', 10);
  controls = updateIncidentControl(controls, 'runtime:x:', 'snooze', 10, 300000);
  const merged = mergeIncidentState(base, controls, [], 20);
  assert.equal(merged[0].acknowledgedAt, 10);
  assert.ok(merged[0].snoozedUntil > 20);
  const escalated = mergeIncidentState([{ ...base[0], severity: 'error' }], controls, merged, 30);
  assert.equal(escalated[0].acknowledgedAt, 0);
  assert.equal(escalated[0].snoozedUntil, 0);
});

test('Cycles 108-109 expose owner severity and one current safe runbook step', () => {
  const incident = { id: 'transport:sequence_gap:', owner: 'transport', code: 'sequence_gap', severity: 'error' };
  const runbook = deriveIncidentRunbook(incident, { selfTest: { ok: true }, consistencyAudit: { ok: true }, deliveryPolicy: { active: false } });
  assert.equal(runbook.current.command, 'resume_catch_up');
  assert.equal(runbook.steps[0].id, 'catch_up');
});

test('Cycle 110 quiet attention hides acknowledged low priority incidents but never critical incidents', () => {
  const model = deriveQuietAttention({ incidents: [
    { id: 'a', severity: 'warn', visible: true, acknowledgedAt: 1, snoozedUntil: 0 },
    { id: 'b', severity: 'critical', visible: true, acknowledgedAt: 1, snoozedUntil: 0 }
  ] }, true, 100);
  assert.deepEqual(model.visibleIncidents.map(item => item.id), ['b']);
  assert.equal(model.attention.incidentId, 'b');
});

test('incident controls and quiet mode survive Runtime Pilot state export and restore', () => {
  const state = new RuntimePilotState([{ sessionId: 's1' }]);
  state.updateIncidentControl('s1', 'transport:x:', 'acknowledge', 0, 10);
  state.setQuietMode('s1', true, 11);
  const restored = new RuntimePilotState(state.exportState()).snapshot('s1', 12);
  assert.equal(restored.incidentControls.quietMode, true);
  assert.equal(restored.incidentControls.controls['transport:x:'].acknowledgedAt, 10);
});
