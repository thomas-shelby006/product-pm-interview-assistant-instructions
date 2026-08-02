import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePreflightWizard } from '../shared/preflight-wizard.js';
import { deriveResumeGuard, validateResumeBoundary } from '../shared/resume-guard.js';
import { deriveCrashResume } from '../shared/crash-resume-model.js';
import { prepareSessionEnd, sessionEndCounts } from '../shared/session-end-guard.js';

function readySnapshot() {
  return {
    mode: 'active', dashboardConnections: 1, contextArmed: true,
    sender: { phase: 'ready', adapterCapabilities: { complete: true } },
    receiver: { phase: 'ready', adapterCapabilities: { complete: true } },
    selfTest: { ok: true, trust: { state: 'active' } }, storagePressure: { level: 'normal' },
    ledgerCounts: { pending: 0, inFlight: 0 }, senderOutboxState: { ready: true, count: 0 },
    sequenceGap: { blocked: false }, deliveryPolicy: { allowPersist: true },
    liveSession: { phase: 'ready' }, batchState: {}, checkpoint: { at: 100, phase: 'ready' }
  };
}

test('Cycle 131: preflight wizard is ordered and action-oriented', () => {
  const snapshot = readySnapshot(); snapshot.contextArmed = false;
  const wizard = derivePreflightWizard(snapshot);
  assert.equal(wizard.ready, false);
  assert.equal(wizard.current.id, 'context');
  assert.equal(wizard.current.command, 'resend_context');
});

test('Cycles 132-133: resume guard blocks durability and draft conflicts before phase mutation', () => {
  const snapshot = readySnapshot(); snapshot.storagePressure.level = 'critical';
  assert.equal(deriveResumeGuard(snapshot).allowed, false);
  assert.equal(validateResumeBoundary(snapshot, 'active').error, 'resume_blocked');
  snapshot.storagePressure.level = 'normal'; snapshot.batchState.draftConflict = { state: 'unresolved' };
  assert.equal(deriveResumeGuard(snapshot).action, 'resolve_draft_restore_pmia');
});

test('Cycle 134: crash resume appears only for a newer safe checkpoint after interruption', () => {
  const snapshot = readySnapshot();
  snapshot.mode = 'degraded';
  snapshot.sender.phase = 'missing';
  snapshot.ledgerCounts.pending = 2;
  const visible = deriveCrashResume(snapshot, 500);
  assert.equal(visible.visible, true);
  assert.equal(visible.unresolved, 2);
  snapshot.crashResumeDismissedAt = 600;
  assert.equal(deriveCrashResume(snapshot, 700).visible, false);
});

test('Cycle 135: session end is blocked while the mock remains Active or Paused', () => {
  const snapshot = readySnapshot();
  snapshot.liveSession.phase = 'active';
  const counts = sessionEndCounts(snapshot);
  assert.equal(counts.liveActive, 1);
  assert.equal(prepareSessionEnd(snapshot, { now: 100, token: 't' }).canEnd, false);
  snapshot.liveSession.phase = 'debrief';
  assert.equal(prepareSessionEnd(snapshot, { now: 100, token: 't' }).canEnd, true);
});

test('session safety source exposes guided preflight, guarded resume, and crash recovery UI', async () => {
  const { readFile } = await import('node:fs/promises');
  const controller = await readFile(new URL('../shared/runtime-pilot-controller.js', import.meta.url), 'utf8');
  const commandRegistry = await readFile(new URL('../shared/operator-command-registry.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');
  assert.match(controller, /derivePreflightWizard/);
  assert.match(controller, /validateResumeBoundary/);
  assert.match(controller, /deriveCrashResume/);
  assert.match(commandRegistry, /run_preflight/);
  assert.match(commandRegistry, /resume_live_session/);
  assert.match(html, /id="crashResumeCard"/);
});
