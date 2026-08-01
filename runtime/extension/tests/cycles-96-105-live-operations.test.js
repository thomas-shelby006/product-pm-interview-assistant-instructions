import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';
import { transitionSessionPhase } from '../shared/session-phase-model.js';
import { deriveInterviewRunbook } from '../shared/interview-runbook.js';
import { deriveSessionClock, pauseSessionClock, resumeSessionClock } from '../shared/session-clock.js';
import { deriveInterviewerSilence } from '../shared/interviewer-silence.js';
import { deriveAttentionTarget } from '../shared/attention-model.js';
import { deriveNextAction } from '../shared/next-action-model.js';
import { commandCatalog, searchCommands } from '../shared/operator-command-catalog.js';
import { createCommandPaletteState, movePaletteSelection } from '../dashboard/command-palette-model.js';
import { deriveFocusMode } from '../dashboard/focus-mode-model.js';

function readySnapshot(now = 100_000) {
  return {
    mode: 'active', contextArmed: true,
    sender: { connected: true, composerReady: true, adapterCapabilities: { complete: true }, adapterCapabilityProbation: { writeSafe: true } },
    receiver: { connected: true, composerReady: true, adapterCapabilities: { complete: true }, adapterCapabilityProbation: { writeSafe: true } },
    selfTest: { ok: true, completedAt: now - 1_000 }, storagePressure: { level: 'normal' },
    deliveryPolicy: { active: false }, consistencyAudit: { ok: true }, warnings: [], ledgerCounts: {}, ledger: [],
    liveSession: { phase: 'setup' }
  };
}

test('Cycle 96 phase transitions are explicit and reject invalid jumps', () => {
  const ready = transitionSessionPhase({ phase: 'setup', history: [] }, 'ready', 10, 'runbook');
  assert.equal(ready.ok, true);
  assert.equal(ready.value.phase, 'ready');
  const invalid = transitionSessionPhase(ready.value, 'debrief', 20, 'operator');
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, 'invalid_session_phase_transition');
});

test('Cycle 96 partial live-session updates preserve phase and clock state', () => {
  const state = new RuntimePilotState([{ sessionId: 's1', createdAt: 1, liveSession: { phase: 'active', startedAt: 10, plannedDurationMs: 1000 } }]);
  state.setLiveSession('s1', { lastInterviewerActivityAt: 20 }, 20);
  const snapshot = state.snapshot('s1', 20);
  assert.equal(snapshot.liveSession.phase, 'active');
  assert.equal(snapshot.liveSession.startedAt, 10);
  assert.equal(snapshot.liveSession.lastInterviewerActivityAt, 20);
});

test('Cycle 97 runbook has one ordered owning action', () => {
  const snapshot = readySnapshot();
  snapshot.contextArmed = false;
  const runbook = deriveInterviewRunbook(snapshot, 100_000);
  assert.equal(runbook.ready, false);
  assert.equal(runbook.next.id, 'context');
  assert.equal(runbook.next.action, 'resend_context');
});

test('Cycles 98-99 start prerequisites and pause/resume clock remain deterministic', () => {
  const running = { startedAt: 100, pausedAt: 0, pausedTotalMs: 0, segment: { startedAt: 100, durationMs: 500 } };
  const paused = pauseSessionClock(running, 300);
  assert.equal(deriveSessionClock(paused, 500).elapsedMs, 200);
  const resumed = resumeSessionClock(paused, 500);
  assert.equal(deriveSessionClock(resumed, 700).elapsedMs, 400);
  assert.equal(deriveSessionClock(resumed, 700).segment.elapsedMs, 400);
});

test('Cycle 100 separates interviewer silence from capture failure', () => {
  const base = { liveSession: { phase: 'active', lastInterviewerActivityAt: 1_000 }, sender: { connected: true } };
  assert.equal(deriveInterviewerSilence(base, 70_000).state, 'long_silence');
  const capture = deriveInterviewerSilence({ ...base, sender: { connected: false } }, 70_000);
  assert.equal(capture.state, 'capture_issue');
});

test('Cycles 101-102 produce one attention target and one next action', () => {
  const snapshot = { ...readySnapshot(), rootCause: { owner: 'transport', code: 'transport_unavailable', severity: 'error', nextAction: 'repair_runtime' } };
  const attention = deriveAttentionTarget(snapshot, 10);
  assert.equal(attention.target, 'transport');
  const action = deriveNextAction(snapshot, 10);
  assert.equal(action.command, 'repair_runtime');
  assert.equal(action.available, true);
});

test('Cycle 103 command palette ranks matches and never runs on search', () => {
  const catalog = commandCatalog(readySnapshot());
  const matches = searchCommands(catalog, 'repair');
  assert.equal(matches[0].id, 'repair_runtime');
  const palette = createCommandPaletteState(readySnapshot(), { open: true, query: 'repair' });
  assert.equal(palette.selected.id, 'repair_runtime');
  assert.equal(palette.preview.id, 'repair_runtime');
});

test('Cycle 104 palette keyboard movement wraps deterministically', () => {
  const palette = createCommandPaletteState(readySnapshot(), { open: true, query: '' });
  const moved = movePaletteSelection({ ...palette, selectedIndex: palette.results.length - 1 }, 1);
  assert.equal(moved.selectedIndex, 0);
});

test('Cycle 105 focus mode is active only for live or paused phases', () => {
  assert.equal(deriveFocusMode({ liveSession: { phase: 'active', focusMode: true } }).compact, true);
  assert.equal(deriveFocusMode({ liveSession: { phase: 'setup', focusMode: true } }).compact, false);
});

test('Cycles 96-105 dashboard packages the navigator and accessible command dialog', async () => {
  const [html, script, css, protocol] = await Promise.all([
    readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('../dashboard/dashboard.css', import.meta.url), 'utf8'),
    readFile(new URL('../shared/dashboard-protocol.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /class="live-session-console"/);
  assert.match(html, /id="commandPalette"[\s\S]*role="dialog"[\s\S]*aria-modal="true"/);
  assert.match(script, /Ctrl|ctrlKey/);
  assert.match(script, /handleToolbarKey/);
  assert.match(css, /data-focus-mode="true"/);
  assert.match(protocol, /'set_focus_mode'/);
});
