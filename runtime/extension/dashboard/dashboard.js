import {
  buildDiagnostics,
  commandResultLabel,
  deriveReview,
  formatDuration,
  latestReceiverProof,
  primaryTransportAction,
  virtualSlice,
  warningLabel
} from './dashboard-model.js';
import { catchUpLabel, deriveLatencyRail } from './live-inbox-model.js';
import { derivePaceGuard, paceLabel } from './pace-guard-model.js';
import { diagnosticTone, groupRuntimeWarnings } from './diagnostics-model.js';
import { deriveGapWatch } from './gap-watch-model.js';
import { deriveOutboxStatus } from './outbox-status-model.js';
import { deriveProofInspector } from './proof-inspector-model.js';
import { deriveMemoryGuard } from './memory-guard-model.js';
import { deriveReadiness } from './readiness-model.js';
import { applySnapshotDelta } from '../shared/snapshot-delta.js';
import { deriveRecoveryProgress } from './recovery-progress-model.js';
import { buildSafeHealthReport } from './health-report-model.js';
import { deriveTransportLanes } from './transport-lane-model.js';
import { deriveBatchPlan } from './batch-plan-model.js';
import { deriveDraftConflict } from './draft-conflict-model.js';
import { deriveDeliverySlaView } from './delivery-sla-model.js';
import { deriveRecoverySchedule } from './recovery-schedule-model.js';
import { deriveSessionEndView } from './session-end-model.js';
import { deriveSelfTestView } from './self-test-model.js';
import { renderTruthRail } from './render-live-status.js';
import { renderRuntimeRole } from './render-runtime-health.js';
import { ReconnectPolicy } from '../shared/reconnect-policy.js';
import { buildTraceIndex, searchDeliveryTraces, inspectDeliveryTrace } from './trace-inspector-model.js';
import { deriveStateCompatibility } from './state-compatibility-model.js';
import { createCommandPaletteState, movePaletteSelection, recordPaletteCommand } from './command-palette-model.js';
import { applyRovingTabIndex, handleToolbarKey } from './toolbar-navigation.js';
import { applyFocusMode, deriveFocusMode } from './focus-mode-model.js';
import { deriveQuestionNavigator } from './question-navigator-model.js';
import { deriveInterviewRunbook } from '../shared/interview-runbook.js';
import { deriveSessionClock } from '../shared/session-clock.js';
import { deriveInterviewerSilence } from '../shared/interviewer-silence.js';
import { deriveAttentionTarget } from '../shared/attention-model.js';
import { deriveNextAction } from '../shared/next-action-model.js';
import { commandCatalog, searchCommands } from '../shared/operator-command-catalog.js';

const params = new URLSearchParams(location.search);
const sessionId = String(params.get('session') || '').trim();
const reconnectPolicy = new ReconnectPolicy({ baseMs: 350, capMs: 8000 });
const state = {
  snapshot: null,
  port: null,
  reconnectAttempt: 0,
  reconnectTimer: null,
  selectedQueueId: '',
  queueFilter: 'actionable',
  questionNavigator: { query: '', group: 'all', priority: 'all', pinned: false, actionable: true, selectedId: '' },
  timelineFilter: 'all',
  activeView: 'overview',
  sessionEnded: false,
  pending: new Map(),
  efficiency: { full: 0, delta: 0, heartbeat: 0, lastMode: 'Waiting', changedSections: 0 },
  endPreparation: null,
  traceQuery: '',
  selectedTraceId: '',
  commandPalette: { open: false, query: '', selectedIndex: 0, recent: [] },
  commandPaletteReturnFocus: null,
  toolbarIndex: 0
};

const byId = id => document.getElementById(id);
const connectionState = byId('connectionState');
const toast = byId('toast');
const timelineViewport = byId('timelineViewport');
const timelineCanvas = byId('timelineCanvas');

function setConnection(label, tone = 'warn') {
  connectionState.dataset.tone = tone;
  connectionState.querySelector('span:last-child').textContent = label;
}

function showToast(message, tone = 'info') {
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function humanizeCode(value) {
  const text = String(value || '').trim().replaceAll('_', ' ');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown';
}

function sendCommand(command, payload = {}) {
  if (!state.port) {
    showToast('Dashboard is not connected.', 'error');
    return Promise.resolve({ ok: false, error: 'dashboard_disconnected' });
  }
  const id = requestId();
  const promise = new Promise(resolve => {
    state.pending.set(id, { resolve, command, startedAt: Date.now() });
    renderOperationActivity();
    updateControlAvailability();
    setTimeout(() => {
      const pending = state.pending.get(id);
      if (!pending) return;
      state.pending.delete(id);
      pending.resolve({ ok: false, error: 'command_timeout' });
      renderOperationActivity();
      updateControlAvailability();
    }, 12000);
  });
  state.port.postMessage({
    sessionId,
    requestId: id,
    command,
    payload
  });
  return promise;
}

function connect() {
  clearTimeout(state.reconnectTimer);
  if (!sessionId) {
    setConnection('Missing session', 'error');
    document.body.dataset.fatal = 'true';
    return;
  }
  document.title = `PMIA_DASHBOARD_${sessionId.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`;
  setConnection('Connecting', 'warn');
  try {
    const port = chrome.runtime.connect({ name: `pmia-dashboard:${sessionId}` });
    state.port = port;
    port.onMessage.addListener(handlePortMessage);
    port.onDisconnect.addListener(() => {
      state.port = null;
      failPendingCommands(state.sessionEnded ? 'session_ended' : 'dashboard_disconnected');
      if (state.sessionEnded) {
        setConnection('Session ended', 'error');
        updateControlAvailability();
        return;
      }
      setConnection('Reconnecting', 'warn');
      scheduleReconnect();
    });
  } catch {
    scheduleReconnect();
  }
}

function failPendingCommands(reason = 'dashboard_disconnected') {
  for (const pending of state.pending.values()) {
    pending.resolve({ ok: false, error: reason });
  }
  state.pending.clear();
  renderOperationActivity();
  updateControlAvailability();
}

function scheduleReconnect() {
  state.reconnectAttempt += 1;
  const decision = reconnectPolicy.failProbe();
  clearTimeout(state.reconnectTimer);
  state.reconnectTimer = setTimeout(connect, decision.delayMs);
}

function handlePortMessage(message) {
  if (message?.type === 'PMIA_DASHBOARD_SNAPSHOT') {
    state.reconnectAttempt = 0;
    reconnectPolicy.succeed();
    state.sessionEnded = false;
    state.snapshot = message.snapshot;
    state.efficiency.full += 1;
    state.efficiency.lastMode = 'Full';
    state.efficiency.changedSections = Object.keys(message.snapshot || {}).length;
    setConnection('Live', 'ok');
    render();
    return;
  }
  if (message?.type === 'PMIA_DASHBOARD_DELTA' && state.snapshot) {
    state.snapshot = applySnapshotDelta(state.snapshot, message.delta);
    state.efficiency.delta += 1;
    state.efficiency.lastMode = 'Delta';
    state.efficiency.changedSections = message.delta?.keys?.length || 0;
    setConnection('Live', 'ok');
    render(message.delta?.keys || []);
    return;
  }
  if (message?.type === 'PMIA_DASHBOARD_SESSION_ENDED') {
    state.sessionEnded = true;
    state.snapshot = null;
    failPendingCommands('session_ended');
    clearTimeout(state.reconnectTimer);
    setConnection('Session ended', 'error');
    render();
    return;
  }
  if (
    message?.type === 'PMIA_DASHBOARD_HEARTBEAT'
    && state.snapshot
    && ['sender', 'receiver'].includes(message.role)
  ) {
    state.snapshot = {
      ...state.snapshot,
      [message.role]: {
        ...state.snapshot[message.role],
        ...(message.patch || {})
      }
    };
    state.efficiency.heartbeat += 1;
    state.efficiency.lastMode = 'Heartbeat';
    state.efficiency.changedSections = 1;
    render([message.role]);
    return;
  }
  if (message?.type === 'PMIA_DASHBOARD_COMMAND_RESULT') {
    const pending = state.pending.get(message.requestId);
    if (!pending) return;
    state.pending.delete(message.requestId);
    pending.resolve(message.result || { ok: false, error: 'empty_command_result' });
    renderOperationActivity();
    updateControlAvailability();
  }
}

function renderEfficiency() {
  const value = state.efficiency;
  text('runtimeEfficiency', `${value.lastMode}${value.changedSections ? ` - ${value.changedSections}` : ''}`);
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function operationLabel(command) {
  return String(command || '')
    .replaceAll('_', ' ')
    .replace(/^./, value => value.toUpperCase());
}

function renderOperationActivity() {
  const node = byId('operationActivity');
  const guard = byId('operationGuard');
  if (!node || !guard) return;
  const pending = [...state.pending.values()];
  guard.dataset.tone = pending.length ? 'busy' : 'idle';
  node.textContent = pending.length
    ? `${operationLabel(pending[0].command)}${pending.length > 1 ? ` +${pending.length - 1}` : ''}`
    : 'Idle';
}

function text(id, value) {
  const node = byId(id);
  if (node) node.textContent = value;
}

function ledgerEntries(snapshot, memberIds = []) {
  const wanted = new Set((Array.isArray(memberIds) ? memberIds : []).map(String));
  return (snapshot?.ledger || []).filter(entry => wanted.has(String(entry?.id || '')));
}

function latestQuestionText(entries) {
  return [...(Array.isArray(entries) ? entries : [])]
    .sort((a, b) => Number(a?.envelope?.seq || 0) - Number(b?.envelope?.seq || 0))
    .at(-1)?.envelope?.text || '';
}

function catchUpDetail(inbox) {
  const details = {
    live: 'Every persisted final has receiver-rendered proof.',
    answering: 'Window 2 is answering the active batch. No later questions are waiting.',
    accumulating: `${inbox.nextCount} question(s) are protected in the next draft while Window 2 answers.`,
    catching_up: `${inbox.pendingCount + inbox.inFlightCount + inbox.nextCount} question state(s) are moving toward rendered proof.`,
    held: `${inbox.nextCount || inbox.pendingCount} question(s) are protected and waiting for operator release.`,
    blocked: inbox.draftConflict
      ? 'A manual composer edit is protected. Resolve the draft conflict before automatic updates continue.'
      : 'Delivery needs attention. All unresolved finals remain in the lossless ledger.'
  };
  return details[inbox.catchUpState] || 'Runtime state is being reconciled.';
}

function renderLatencyRail(snapshot) {
  const rail = byId('latencyRail');
  rail.replaceChildren();
  const latency = deriveLatencyRail(snapshot);
  if (!latency.envelopeId) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No final has entered the latency rail yet.';
    rail.append(empty);
    return;
  }
  const firstIncomplete = latency.milestones.findIndex(item => !item.complete);
  latency.milestones.forEach((milestone, index) => {
    const step = document.createElement('div');
    step.className = 'latency-step';
    if (milestone.complete) step.classList.add('complete');
    else if (index === firstIncomplete) step.classList.add('current');
    const label = document.createElement('span');
    label.textContent = milestone.label;
    const value = document.createElement('strong');
    value.textContent = milestone.complete
      ? formatDuration(milestone.elapsedMs || 0)
      : index === firstIncomplete ? 'In progress' : 'Waiting';
    step.append(label, value);
    rail.append(step);
  });
}

function renderReadiness(snapshot, now) {
  const readiness = deriveReadiness(snapshot, now);
  const gate = byId('readinessGate');
  gate.dataset.readiness = readiness.state;
  text('readinessLabel', readiness.label);
  text('readinessSummary', readiness.state === 'ready'
    ? 'Window 1, Window 2, context, delivery, and storage checks are healthy.'
    : readiness.state === 'repairing'
      ? 'Repair is running. Ready will appear only after every check passes.'
      : `${readiness.blockers.length} blocker(s). Primary cause: ${humanizeCode(readiness.rootCause?.code)}.`);
  const list = byId('readinessBlockers');
  list.replaceChildren();
  for (const value of readiness.blockers.slice(0, 5)) {
    const item = document.createElement('li');
    item.textContent = value.label;
    list.append(item);
  }
  const banner = byId('deliveryPolicyBanner');
  const policy = snapshot?.deliveryPolicy || {};
  banner.hidden = policy.active !== true;
  if (!banner.hidden) {
    text('deliveryPolicyLabel', policy.reason === 'operator_hold' ? 'Forwarding paused' : 'Queue-only protection');
    text('deliveryPolicyDetail', policy.reason === 'operator_hold'
      ? 'Every final remains durable until you resume forwarding.'
      : `Provider writes are blocked by ${String(policy.reason || 'runtime safety')}. Finals remain in the lossless inbox until ${String(policy.resumeWhen || 'the runtime is healthy')}.`);
  }
}

function renderLiveOperations(snapshot, now) {
  const operations = snapshot?.liveOperations || {};
  const liveSession = snapshot?.liveSession || {};
  const clock = operations.clock || { elapsedMs: 0, segment: {} };
  const runbook = operations.runbook || { completed: 0, total: 0, steps: [], ready: false };
  const phase = String(liveSession.phase || operations.phase?.phase || 'setup');
  text('liveSessionPhase', humanizeCode(phase));
  text('liveSessionClock', formatDuration(clock.elapsedMs || 0));
  const segment = clock.segment || {};
  text('liveSessionDetail', segment.label
    ? `${segment.label}${segment.remainingMs !== null && segment.remainingMs !== undefined ? ` - ${formatDuration(segment.remainingMs)} remaining` : ''}`
    : phase === 'setup' ? 'Complete the preflight runbook before starting.'
      : phase === 'ready' ? 'All prerequisites are healthy. Start when the interviewer is ready.'
        : phase === 'paused' ? 'The session clock and forwarding are paused.'
          : phase === 'debrief' ? 'Review delivery, answers, markers, and export evidence.'
            : 'Live interview timing and delivery are active.');
  document.querySelectorAll('[data-session-phase]').forEach(button => {
    const current = button.dataset.sessionPhase === phase;
    button.setAttribute('aria-current', current ? 'step' : 'false');
    button.disabled = phase === 'ended';
  });
  text('runbookProgress', `${runbook.completed || 0} / ${runbook.total || 0}`);
  const runbookSteps = byId('runbookSteps');
  runbookSteps.replaceChildren();
  for (const step of runbook.steps || []) {
    const item = document.createElement('li');
    item.dataset.complete = step.complete ? 'true' : 'false';
    item.textContent = step.label;
    if (!step.complete && step.detail) item.title = step.detail;
    runbookSteps.append(item);
  }
  const start = byId('startMockAction');
  start.disabled = !runbook.ready || ['active', 'paused', 'debrief', 'ended'].includes(phase);
  start.textContent = phase === 'active' ? 'Mock active' : phase === 'paused' ? 'Mock paused' : 'Start mock';

  const attention = operations.attention || { target: 'none', reason: 'caught_up', severity: 'none', action: '' };
  const nextAction = operations.nextAction || { available: false };
  const attentionPanel = document.querySelector('.attention-panel');
  if (attentionPanel) attentionPanel.dataset.severity = attention.severity || 'none';
  text('attentionTitle', attention.target === 'none' ? 'Caught up' : humanizeCode(attention.target));
  text('attentionDetail', attention.reason === 'caught_up'
    ? 'No operator action is required.'
    : `${humanizeCode(attention.reason)}${nextAction.label ? ` - ${nextAction.label}` : ''}.`);
  const actionButton = byId('nextBestAction');
  actionButton.hidden = !nextAction.available;
  actionButton.dataset.command = nextAction.command || '';
  actionButton.textContent = nextAction.label || 'Run next action';

  const silence = operations.silence || { state: 'inactive', ageMs: 0, label: 'Not timing interviewer silence' };
  const silencePanel = document.querySelector('.silence-panel');
  if (silencePanel) silencePanel.dataset.state = silence.state || 'inactive';
  text('silenceState', silence.label || humanizeCode(silence.state));
  text('silenceDetail', silence.state === 'capture_issue'
    ? 'This is a capture/runtime issue, not interviewer silence. Run Check live.'
    : silence.state === 'inactive' ? 'Starts when the mock interview becomes active.'
      : `${formatDuration(silence.ageMs || 0)} since the last interviewer activity signal.`);
  applyFocusMode(document, deriveFocusMode(snapshot));
  const toolbar = byId('phaseRail');
  if (toolbar) applyRovingTabIndex(toolbar, state.toolbarIndex);
}

function renderCommandPalette() {
  state.commandPalette = createCommandPaletteState(state.snapshot || {}, state.commandPalette);
  const dialog = byId('commandPalette');
  dialog.hidden = !state.commandPalette.open;
  if (!state.commandPalette.open) return;
  const results = byId('commandPaletteResults');
  results.replaceChildren();
  state.commandPalette.results.forEach((command, index) => {
    const button = document.createElement('button');
    button.className = 'command-palette-result';
    button.dataset.paletteIndex = String(index);
    button.dataset.commandId = command.id;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(index === state.commandPalette.selectedIndex));
    button.disabled = command.available === false;
    const label = document.createElement('span');
    label.textContent = command.label;
    const shortcut = document.createElement('kbd');
    shortcut.textContent = command.shortcut || command.group;
    const detail = document.createElement('small');
    detail.textContent = command.available === false ? humanizeCode(command.blockedReason) : `${command.group} - ${humanizeCode(command.risk)}`;
    button.append(label, shortcut, detail);
    results.append(button);
  });
  const selected = state.commandPalette.selected;
  const preview = byId('commandPalettePreview');
  preview.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = selected?.label || 'No command matches';
  const detail = document.createElement('p');
  detail.textContent = selected
    ? `${humanizeCode(selected.risk)} risk. ${selected.available === false ? `Unavailable: ${humanizeCode(selected.blockedReason)}.` : 'Press Enter to run through the existing operation guard.'}`
    : 'Change the search query.';
  preview.append(title, detail);
}

function openCommandPalette(trigger = document.activeElement) {
  state.commandPaletteReturnFocus = trigger instanceof HTMLElement ? trigger : null;
  state.commandPalette = { ...state.commandPalette, open: true, query: '', selectedIndex: 0 };
  byId('commandPaletteSearch').value = '';
  renderCommandPalette();
  queueMicrotask(() => byId('commandPaletteSearch').focus());
}

function closeCommandPalette() {
  state.commandPalette = { ...state.commandPalette, open: false };
  renderCommandPalette();
  state.commandPaletteReturnFocus?.focus?.();
  state.commandPaletteReturnFocus = null;
}

async function executePaletteSelection() {
  const selected = state.commandPalette.selected;
  if (!selected || selected.available === false) return;
  const result = await runCommand(commandButton(selected.id), selected.id);
  if (result?.ok) state.commandPalette.recent = recordPaletteCommand(state.commandPalette.recent, selected.id);
  closeCommandPalette();
}

function renderLiveCommandCenter(snapshot, now) {
  if (!snapshot) {
    const stateCard = document.querySelector('.live-state-card');
    if (stateCard) stateCard.dataset.catchUp = 'answering';
    text('catchUpState', state.sessionEnded ? 'Session ended' : 'Connecting');
    text('catchUpDetail', state.sessionEnded
      ? 'The lossless session state was cleared after managed shutdown.'
      : 'Waiting for the first authoritative ledger snapshot.');
    renderTruthRail({ document, snapshot: null, now, text, sessionEnded: state.sessionEnded });
    for (const id of ['inboxPending', 'inboxInFlight', 'inboxProven']) text(id, '0');
    text('currentAnswerBadge', 'Idle');
    text('currentBatchTitle', 'No active batch');
    text('currentBatchMembers', 'Waiting for Window 2 state.');
    text('nextDraftBadge', '0 questions');
    text('nextDraftTitle', 'Nothing waiting');
    text('nextDraftText', 'Waiting for lossless inbox state.');
    text('paceState', '--');
    text('paceRates', '--');
    text('paceForecast', 'Waiting for delivery-rate evidence.');
    text('gapState', '--');
    text('gapTitle', 'Waiting for sequence state');
    text('gapDetail', 'No receiver sequence evidence is available yet.');
    text('outboxState', '--');
    text('outboxTitle', 'Waiting for sender state');
    text('outboxDetail', 'No sender outbox evidence is available yet.');
    text('proofState', '--');
    text('proofTitle', 'Waiting for proof state');
    text('proofDetail', 'No batch proof evidence is available yet.');
    text('recoveryPhase', '--');
    text('recoveryTitle', 'Waiting for recovery state');
    byId('recoveryChecks')?.replaceChildren();
    text('recoveryError', '');
    text('recoveryScheduleState', 'No durable check scheduled');
    text('recoveryScheduleDetail', 'Recovery alarms appear here.');
    text('storagePressureBadge', '--');
    text('storagePressureValue', '--');
    text('storagePressureDetail', 'Session memory status is not available yet.');
    text('hiddenRuntimeState', '--');
    text('hiddenRuntimeTitle', 'Waiting for receiver scheduler state');
    text('hiddenRuntimeDetail', 'No hidden-window progress evidence is available yet.');
    text('commandJournalState', '--');
    text('commandJournalTitle', 'Waiting for operator command history');
    byId('commandJournalList')?.replaceChildren();
    text('transportLaneState', '--');
    text('senderTransportLane', 'Unknown');
    text('receiverTransportLane', 'Unknown');
    text('senderTransportDetail', 'No direct-port evidence.');
    text('receiverTransportDetail', 'No direct-port evidence.');
    text('batchPlanState', '--');
    text('batchPlanTitle', 'Waiting for protected batch state');
    text('batchPlanDetail', 'No partition plan is available yet.');
    document.querySelector('.draft-conflict-panel')?.setAttribute('hidden', '');
    text('deliverySlaState', '--');
    text('deliverySlaTitle', 'Waiting for delivery age');
    text('deliverySlaDetail', 'No delivery SLA evidence is available yet.');
    text('selfTestState', '--');
    text('selfTestTitle', 'Waiting for active self-test state');
    text('selfTestDetail', 'No control-plane pulse is available yet.');
    text('oldestInboxAge', '--');
    renderLatencyRail(null);
    return;
  }
  const { inbox, answerStatus } = renderTruthRail({ document, snapshot, now, text, sessionEnded: state.sessionEnded });
  const stateCard = document.querySelector('.live-state-card');
  if (stateCard) stateCard.dataset.catchUp = inbox.catchUpState;
  text('catchUpState', catchUpLabel(inbox.catchUpState));
  text('catchUpDetail', catchUpDetail(inbox));
  text('inboxPending', String(inbox.pendingCount));
  text('inboxInFlight', String(inbox.inFlightCount));
  text('inboxProven', String(inbox.provenCount));
  text('oldestInboxAge', inbox.oldestAgeMs ? `Oldest ${formatDuration(inbox.oldestAgeMs)}` : 'Caught up');

  const active = inbox.activeBatch;
  const activeIds = active?.memberIds || active?.prompt?.memberIds || [];
  const activeEntries = ledgerEntries(snapshot, activeIds);
  const activeCount = Number(active?.questionCount || activeIds.length || 0);
  text('currentAnswerBadge', answerStatus.label);
  text('currentBatchTitle', active
    ? `${activeCount || activeIds.length} question active batch`
    : 'No active batch');
  text('currentBatchMembers', active
    ? (latestQuestionText(activeEntries)
      ? `Latest focus: ${latestQuestionText(activeEntries)}`
      : `Batch ${active?.batchId || active?.id || ''} - ${activeIds.length} protected member(s)`)
    : 'Window 2 is ready for the next question.');

  const next = inbox.nextBatch;
  const nextIds = next?.memberIds || next?.prompt?.memberIds || [];
  const nextEntries = ledgerEntries(snapshot, nextIds);
  text('nextDraftBadge', `${inbox.nextCount} question${inbox.nextCount === 1 ? '' : 's'}`);
  text('nextDraftTitle', inbox.nextCount
    ? (inbox.nextCount === 1 ? 'Next question protected' : 'Accumulated multi-question batch')
    : 'Nothing waiting');
  text('nextDraftText', inbox.nextCount
    ? (inbox.nextCount === 1
      ? latestQuestionText(nextEntries) || 'One persisted question is staged for Window 2.'
      : `${inbox.nextCount - 1} earlier question(s) preserved. Latest focus: ${latestQuestionText(nextEntries) || 'latest member'}`)
    : 'New questions will accumulate here while Window 2 is answering.');

  const pace = derivePaceGuard(snapshot, now);
  const pacePanel = document.querySelector('.pace-panel');
  if (pacePanel) pacePanel.dataset.pace = pace.state;
  text('paceState', paceLabel(pace.state));
  text('paceRates', `${pace.intakePerMinute} in / ${pace.proofPerMinute} proven per min`);
  text('paceForecast', pace.unresolved === 0
    ? 'No unresolved finals.'
    : pace.estimatedCatchUpMs !== null
      ? `${pace.unresolved} unresolved - estimated catch-up ${formatDuration(pace.estimatedCatchUpMs)}.`
      : pace.state === 'falling_behind'
        ? `${pace.unresolved} unresolved - intake is exceeding rendered proof.`
        : `${pace.unresolved} unresolved - waiting for a positive recovery rate.`);

  const recoverySchedule = deriveRecoverySchedule(snapshot, now);
  text('recoveryScheduleState', recoverySchedule.scheduled
    ? `${recoverySchedule.kind === 'verify' ? 'Verification' : 'Timeout'} in ${formatDuration(recoverySchedule.dueInMs)}`
    : 'No durable check scheduled');
  text('recoveryScheduleDetail', recoverySchedule.scheduled
    ? `${recoverySchedule.count} alarm(s) persisted - source ${recoverySchedule.source.replaceAll('_', ' ')} - attempt ${recoverySchedule.attempt}.`
    : 'Recovery alarms appear here.');

  const recovery = deriveRecoveryProgress(snapshot);
  const recoveryPanel = document.querySelector('.recovery-panel');
  if (recoveryPanel) recoveryPanel.dataset.recovery = recovery.phase;
  text('recoveryPhase', recovery.phase);
  text('recoveryTitle', recovery.verified ? 'Recovery verified' : `${recovery.complete}/${recovery.total} checks complete`);
  const recoveryChecks = byId('recoveryChecks');
  recoveryChecks.replaceChildren();
  for (const check of recovery.items) {
    const item = document.createElement('span');
    item.dataset.complete = check.complete ? 'true' : 'false';
    item.textContent = `${check.complete ? 'OK' : 'WAIT'} - ${check.label}`;
    recoveryChecks.append(item);
  }
  text('recoveryError', recovery.error);

  const proofInspector = deriveProofInspector(snapshot);
  const proofPanel = document.querySelector('.proof-panel');
  if (proofPanel) proofPanel.dataset.proof = proofInspector.state;
  text('proofState', proofInspector.label);
  text('proofTitle', proofInspector.batchId
    ? `${proofInspector.batchId} - ${proofInspector.memberCount} member(s)`
    : 'No batch evaluated');
  text('proofDetail', proofInspector.detail);

  const outbox = deriveOutboxStatus(snapshot, now);
  const outboxPanel = document.querySelector('.outbox-panel');
  if (outboxPanel) outboxPanel.dataset.outbox = outbox.state;
  text('outboxState', outbox.state === 'clear' ? 'Clear' : outbox.replaying ? 'Retrying' : `${outbox.count} retained`);
  text('outboxTitle', outbox.count ? `${outbox.count} final(s) awaiting persistence` : 'No unpersisted finals');
  text('outboxDetail', outbox.count
    ? `${outbox.lastError || outbox.persistenceError || 'Waiting for service-worker acknowledgement'}${outbox.retryInMs ? ` - retry in ${formatDuration(outbox.retryInMs)}` : ''}.`
    : outbox.restoredCount
      ? `Restored ${outbox.restoredCount} final(s) from ${String(outbox.recoverySource || 'session state').replaceAll('_', ' ')}; all are now persisted.`
      : 'Window 1 has no pending persistence acknowledgement.');

  const gap = deriveGapWatch(snapshot, now);
  const gapPanel = document.querySelector('.gap-panel');
  if (gapPanel) gapPanel.dataset.gap = gap.state;
  text('gapState', gap.label);
  text('gapTitle', gap.state === 'clear' ? 'Sequences are contiguous' : `Waiting for sequence ${gap.expectedSeq}`);
  text('gapDetail', gap.state === 'clear'
    ? 'No out-of-order finals are waiting.'
    : `${gap.bufferedCount} later final(s) remain protected${gap.highestBufferedSeq ? ` through #${gap.highestBufferedSeq}` : ''}.`);

  const storagePanel = document.querySelector('.storage-panel');
  if (storagePanel) storagePanel.dataset.pressure = inbox.storage.level || 'normal';
  text('storagePressureBadge', String(inbox.storage.level || 'normal').replace(/^./, value => value.toUpperCase()));
  text('storagePressureValue', `${Number(inbox.storage.percent || 0).toFixed(1)}%`);
  text('storagePressureDetail', inbox.storage.level === 'normal'
    ? 'Lossless ledger storage is healthy.'
    : inbox.storage.level === 'elevated'
      ? 'Storage is elevated; unresolved finals remain fully protected.'
      : inbox.storage.level === 'high'
        ? 'Proven history is compacting; unresolved finals are untouched.'
        : 'Critical pressure. Unresolved finals remain protected; export or end the session soon.');
  const selfTest = deriveSelfTestView(snapshot, now);
  const selfTestPanel = document.querySelector('.self-test-panel');
  if (selfTestPanel) selfTestPanel.dataset.state = selfTest.state;
  text('selfTestState', selfTest.label);
  text('selfTestTitle', selfTest.state === 'active'
    ? `Actively verified ${formatDuration(selfTest.ageMs)} ago`
    : selfTest.state === 'evidence_fresh'
      ? 'Verification extended by fresh role evidence'
      : selfTest.state === 'failed'
        ? 'One or more active checks failed'
        : selfTest.state === 'stale'
          ? 'Active verification evidence is stale'
          : 'Control plane not actively verified');
  text('selfTestDetail', selfTest.detail);

  const deliverySla = deriveDeliverySlaView(snapshot, now);
  const slaPanel = document.querySelector('.delivery-sla-panel');
  if (slaPanel) slaPanel.dataset.state = deliverySla.state;
  text('deliverySlaState', deliverySla.label);
  text('deliverySlaTitle', deliverySla.oldestAgeMs
    ? `Oldest unresolved ${formatDuration(deliverySla.oldestAgeMs)} - target ${formatDuration(deliverySla.targetMs)}`
    : 'No unresolved final');
  text('deliverySlaDetail', deliverySla.oldestAgeMs
    ? `Next action: ${deliverySla.nextAction}${deliverySla.reason ? ` - ${deliverySla.reason.replaceAll('_', ' ')}` : ''}.`
    : 'Automatic escalation begins only when a protected final exceeds its delivery window.');

  const draftConflict = deriveDraftConflict(snapshot);
  const conflictPanel = document.querySelector('.draft-conflict-panel');
  if (conflictPanel) {
    conflictPanel.hidden = !draftConflict.visible;
    conflictPanel.dataset.state = draftConflict.state;
  }
  text('draftConflictState', draftConflict.label);
  text('draftConflictTitle', draftConflict.state === 'keep_manual'
    ? 'Manual draft retained; protected questions remain queued.'
    : draftConflict.state === 'restore_pmia'
      ? 'Protected PMIA draft restored.'
      : draftConflict.state === 'merge'
        ? 'Manual prefix and protected PMIA draft merged.'
        : 'Manual text differs from the PMIA draft');
  text('draftConflictDetail', draftConflict.state === 'unresolved'
    ? 'Choose how Window 2 should preserve the manual text and protected PMIA batch.'
    : 'The resolution is recorded. Lossless batch membership remains unchanged.');

  const batchPlan = deriveBatchPlan(snapshot);
  text('batchPlanState', batchPlan.partitionCount ? `${batchPlan.partitionCount} batch${batchPlan.partitionCount === 1 ? '' : 'es'}` : 'No batches');
  text('batchPlanTitle', batchPlan.protectedCount
    ? `${batchPlan.protectedCount} protected question${batchPlan.protectedCount === 1 ? '' : 's'}`
    : 'Nothing waiting');
  text('batchPlanDetail', batchPlan.protectedCount
    ? `${batchPlan.currentCount} in the next provider-safe batch; ${batchPlan.remainingCount} preserved for later sequential submission.`
    : 'Accumulated finals will be partitioned only when provider limits require it.');

  const lanes = deriveTransportLanes(snapshot, now);
  text('transportLaneState', lanes.sender.state === 'closed' && lanes.receiver.state === 'closed' ? 'Direct' : 'Guarded');
  for (const [role, value] of Object.entries(lanes)) {
    const prefix = role === 'sender' ? 'sender' : 'receiver';
    text(`${prefix}TransportLane`, value.label);
    text(`${prefix}TransportDetail`, value.rttMs
      ? `${value.rttMs} ms RTT${value.failures ? ` - ${value.failures} failure(s)` : ''}`
      : value.retryInMs
        ? `${value.reason || 'Direct port unavailable'} - probe in ${formatDuration(value.retryInMs)}`
        : value.reason || 'No direct-port sample yet.');
  }

  const commands = Array.isArray(snapshot?.commandJournal) ? snapshot.commandJournal : [];
  text('commandJournalState', commands.length ? `${commands.length} recent` : 'No history');
  text('commandJournalTitle', commands[0]
    ? `${operationLabel(commands[0].command)} - ${commands[0].result?.ok ? 'Succeeded' : 'Failed'} in ${formatDuration(commands[0].durationMs || 0)}`
    : 'No command completed');
  const commandList = byId('commandJournalList');
  commandList.replaceChildren();
  for (const command of commands.slice(0, 5)) {
    const item = document.createElement('span');
    item.dataset.ok = command.result?.ok ? 'true' : 'false';
    item.textContent = `${operationLabel(command.command)} - ${command.result?.ok ? 'OK' : command.result?.error || 'Failed'} - ${formatDuration(command.durationMs || 0)}${command.replayCount ? ` - replayed ${command.replayCount}` : ''}`;
    commandList.append(item);
  }

  const scheduler = snapshot?.receiver?.schedulerState || {};
  const visibility = String(snapshot?.receiver?.pageVisibility || scheduler.visibilityState || 'unknown');
  const hiddenPanel = document.querySelector('.hidden-runtime-panel');
  if (hiddenPanel) hiddenPanel.dataset.visibility = visibility;
  text('hiddenRuntimeState', visibility === 'hidden' ? 'Hidden' : visibility === 'visible' ? 'Visible' : 'Unknown');
  text('hiddenRuntimeTitle', scheduler.phase && scheduler.phase !== 'idle'
    ? `${String(scheduler.phase).replaceAll('_', ' ')} - ${scheduler.reason || 'provider wait'}`
    : 'Receiver scheduler is idle');
  text('hiddenRuntimeDetail', scheduler.wakeSource
    ? `Last wake: ${scheduler.wakeSource}. Visibility: ${visibility}. Check ${Number(scheduler.check || 0)}.`
    : `Visibility: ${visibility}. No provider wait is active.`);

  const memory = deriveMemoryGuard(snapshot);
  const memoryBreakdown = byId('memoryBreakdown');
  memoryBreakdown.replaceChildren();
  for (const [label, bytes] of [
    ['Protected', memory.actionableBytes],
    ['Proven', memory.provenBytes],
    ['Telemetry', memory.telemetryBytes],
    ['Snapshots', memory.snapshotBytes]
  ]) {
    const item = document.createElement('span');
    item.textContent = `${label} ${formatBytes(bytes)}`;
    memoryBreakdown.append(item);
  }
  renderLatencyRail(snapshot);
}

function renderWarnings(snapshot) {
  const container = byId('warningList');
  const groupsContainer = byId('diagnosticGroups');
  container.replaceChildren();
  groupsContainer.replaceChildren();
  if (!snapshot) {
    const item = document.createElement('p');
    item.className = 'empty';
    item.textContent = state.sessionEnded
      ? 'This managed session has ended. Runtime controls are disabled.'
      : 'Waiting for the first live runtime snapshot.';
    container.append(item);
    text('healthScore', state.sessionEnded ? 'Ended' : 'Connecting');
    return;
  }
  const groups = groupRuntimeWarnings(snapshot.warnings || []);
  for (const group of groups) {
    const item = document.createElement('article');
    item.className = 'diagnostic-group';
    item.dataset.tone = diagnosticTone(group);
    const label = document.createElement('span');
    label.textContent = group.label;
    const value = document.createElement('strong');
    value.textContent = group.critical ? `${group.critical} critical` : group.count ? `${group.count} attention` : 'Healthy';
    item.append(label, value);
    groupsContainer.append(item);
  }
  const warnings = [...(snapshot.warnings || [])];
  if (!warnings.length) {
    const item = document.createElement('p');
    item.className = 'empty';
    item.textContent = 'All runtime markers are healthy.';
    container.append(item);
    text('healthScore', 'Healthy');
    return;
  }
  for (const warning of warnings) {
    const item = document.createElement('div');
    item.className = `warning-item ${warning.severity === 'error' ? 'error' : ''}`;
    item.textContent = warningLabel(warning);
    container.append(item);
  }
  const errors = warnings.filter(item => item.severity === 'error').length;
  text('healthScore', errors ? `${errors} critical` : `${warnings.length} attention`);
}

function renderOverview(snapshot, now) {
  text('sessionId', snapshot?.sessionId || sessionId || '--');
  text('route', snapshot ? `${snapshot.sender?.provider || '?'} -> ${snapshot.receiver?.provider || '?'}` : '--');
  text('transportMode', snapshot?.mode || '--');
  text('uptime', snapshot ? formatDuration(now - snapshot.createdAt) : '--');
  renderOperationActivity();
  renderEfficiency();
  renderReadiness(snapshot, now);
  renderLiveCommandCenter(snapshot, now);
  renderRuntimeRole({ roleName: 'sender', role: snapshot?.sender, now, text, healthNode: byId('senderHealth') });
  renderRuntimeRole({ roleName: 'receiver', role: snapshot?.receiver, now, text, healthNode: byId('receiverHealth') });
  renderWarnings(snapshot);
  text('deliverySuccess', snapshot ? `${snapshot.metrics?.deliverySuccessRate ?? 100}%` : '--');
  text('averageProof', snapshot ? formatDuration(snapshot.metrics?.averageDeliveryProofMs || 0) : '--');
  text('queuedFinals', String((snapshot?.ledgerCounts?.pending || 0) + (snapshot?.ledgerCounts?.inFlight || 0)));
  text('answerTimeouts', String(snapshot?.metrics?.answerTimeouts || 0));
  text('latestPreview', snapshot?.latestPreview?.text || 'No preview observed.');
  text('latestFinal', snapshot?.latestFinal?.text || 'No final observed.');
  text('latestAnswer', snapshot?.receiver?.latestAnswer?.text || snapshot?.latestAnswer?.text || 'No answer captured.');
  const proof = snapshot?.latestProof || latestReceiverProof(snapshot?.timeline)?.data || null;
  text('latestProof', proof
    ? (proof.ok
      ? `${proof.proof || 'rendered_turn'} - ${proof.verified === false ? 'unverified' : 'verified'} - ${proof.envelopeId || ''}`
      : `${proof.reason || 'proof_failed'} - ${proof.envelopeId || ''}`)
    : 'No receiver proof recorded.');
  const activeQueue = (snapshot?.ledger || []).filter(item => ['persisted', 'failed', 'staged', 'submitting'].includes(item?.state));
  text('queueBadge', String(activeQueue.length));
  const primary = primaryTransportAction(snapshot?.mode);
  const primaryButton = byId('primaryTransportAction');
  primaryButton.dataset.command = primary.command;
  primaryButton.textContent = primary.label;
  const autoSubmit = snapshot?.batchState?.autoSubmit !== false;
  const hold = Boolean(snapshot?.batchState?.hold);
  text('autoSubmitAction', `Auto-submit: ${autoSubmit ? 'On' : 'Off'}`);
  text('holdAction', `Hold after answer: ${hold ? 'On' : 'Off'}`);
}

function renderQuestionInspector(navigator) {
  const selected = navigator.selected;
  const inspector = byId('questionInspector');
  inspector.dataset.empty = selected ? 'false' : 'true';
  text('questionInspectorTitle', selected ? `Question #${selected.seq || '--'}` : 'No question selected');
  text('questionInspectorMeta', selected
    ? `${selected.id} - ${selected.batchId || 'No batch'} - ${selected.operator.priority || 'normal'} priority`
    : 'Select a ledger entry to inspect delivery and operator metadata.');
  text('questionInspectorText', selected?.text || '');
  text('questionInspectorStatus', selected?.status?.label || '--');
  text('questionInspectorTrace', selected?.traceId || '--');
  text('questionInspectorDuplicate', selected?.duplicate?.duplicate
    ? `${selected.duplicate.count} duplicate event(s) - retained ${selected.duplicate.retainedId}` : 'No');
  text('questionInspectorRelationship', selected?.relationship?.parentId ? `Follow-up to ${selected.relationship.parentId}` : 'None');
  const pin = byId('pinQuestion');
  pin.disabled = !selected;
  pin.textContent = selected?.operator?.pinned ? 'Unpin question' : 'Pin question';
  byId('setQuestionPriority').disabled = !selected;
  byId('setQuestionPriority').value = selected?.operator?.priority || 'normal';
  byId('deferQuestion').disabled = !selected;
  byId('deferQuestion').value = selected?.operator?.deferCondition || 'none';
  byId('questionParentId').disabled = !selected;
  byId('questionParentId').value = selected?.relationship?.parentId || '';
  byId('linkQuestion').disabled = !selected;
  const undo = byId('undoQuestionAction');
  undo.hidden = !navigator.latestUndo;
  undo.dataset.undoId = navigator.latestUndo?.id || '';
  undo.textContent = navigator.latestUndo ? `Undo ${humanizeCode(navigator.latestUndo.action)}` : 'Undo last metadata change';
}

function renderQueue(snapshot, now) {
  const body = byId('queueBody');
  body.replaceChildren();
  state.questionNavigator = {
    ...state.questionNavigator,
    actionable: state.queueFilter !== 'all',
    selectedId: state.selectedQueueId || state.questionNavigator.selectedId || ''
  };
  const navigator = deriveQuestionNavigator(snapshot || {}, state.questionNavigator, now);
  state.questionNavigator = { ...state.questionNavigator, selectedId: navigator.selectedId };
  state.selectedQueueId = navigator.selectedId;
  const inbox = navigator.results;
  if (!inbox.length) {
    state.selectedQueueId = '';
    state.questionNavigator.selectedId = '';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'empty';
    cell.textContent = state.queueFilter === 'all' ? 'No questions match the current filters.' : 'Inbox is caught up.';
    row.append(cell);
    body.append(row);
    renderQuestionInspector({ ...navigator, selected: null, selectedId: '' });
    return;
  }
  for (const item of inbox) {
    const row = document.createElement('tr');
    const ledgerState = item.state || 'persisted';
    row.dataset.pinned = item.operator?.pinned ? 'true' : 'false';
    row.dataset.priority = item.operator?.priority || 'normal';
    if (item.id === state.selectedQueueId) row.classList.add('selected');
    row.classList.add(ledgerState);
    row.addEventListener('click', () => {
      state.selectedQueueId = item.id;
      state.questionNavigator.selectedId = item.id;
      renderQueue(state.snapshot, Date.now());
    });
    const selectCell = document.createElement('td');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'queueItem';
    radio.checked = item.id === state.selectedQueueId;
    radio.disabled = !item.status?.actionable;
    radio.setAttribute('aria-label', `Select question ${item.envelope?.seq || ''}`);
    selectCell.append(radio);
    const age = document.createElement('td');
    age.textContent = formatDuration(now - Number(item.persistedAt || item.queuedAt || now));
    const seq = document.createElement('td');
    seq.textContent = String(item.envelope?.seq || 0);
    const status = document.createElement('td');
    status.textContent = item.status?.label || ledgerState;
    const priority = document.createElement('td');
    priority.className = 'priority';
    priority.dataset.priority = item.operator?.priority || 'normal';
    priority.textContent = `${item.operator?.pinned ? 'Pinned - ' : ''}${item.operator?.priority || 'normal'}${item.deferred ? ' - deferred' : ''}`;
    const batch = document.createElement('td');
    batch.className = 'batch';
    batch.textContent = item.batchId || '--';
    const question = document.createElement('td');
    question.className = 'question';
    question.textContent = item.envelope?.text || '';
    row.append(selectCell, age, seq, status, priority, batch, question);
    body.append(row);
  }
  renderQuestionInspector(navigator);
}

function eventCategory(type) {
  const value = String(type || '');
  if (/answer/.test(value)) return 'answer';
  if (/health|heartbeat|registration|live_check|warning|role_/.test(value)) return 'health';
  if (/command|layout|repair|dashboard|scroll|mic|mute|pause|resume/.test(value)) return 'control';
  return 'transport';
}

function eventSummary(event) {
  const data = event?.data || {};
  const parts = [];
  for (const key of ['role', 'command', 'reason', 'envelopeId', 'queueItemId', 'mode']) {
    if (data[key] !== undefined && data[key] !== '') parts.push(`${key}: ${data[key]}`);
  }
  if (data.ok !== undefined) parts.push(`ok: ${data.ok}`);
  return parts.join(' - ') || 'State updated';
}

function filteredTimeline(snapshot) {
  const events = snapshot?.timeline || [];
  if (state.timelineFilter === 'all') return events;
  return events.filter(event => eventCategory(event.type) === state.timelineFilter);
}

function renderTimeline(snapshot) {
  const events = filteredTimeline(snapshot);
  const slice = virtualSlice(events, timelineViewport.scrollTop, timelineViewport.clientHeight, 52, 6);
  timelineCanvas.style.height = `${Math.max(slice.totalHeight, timelineViewport.clientHeight)}px`;
  timelineCanvas.replaceChildren();
  slice.items.forEach((event, offset) => {
    const row = document.createElement('div');
    row.className = 'timeline-row';
    row.style.top = `${(slice.start + offset) * 52}px`;
    const time = document.createElement('time');
    time.textContent = new Date(event.at).toLocaleTimeString([], { hour12: false });
    const type = document.createElement('b');
    type.textContent = event.type;
    const summary = document.createElement('span');
    summary.textContent = eventSummary(event);
    row.append(time, type, summary);
    timelineCanvas.append(row);
  });
}

function reviewItem(label, value) {
  const item = document.createElement('div');
  item.className = 'review-item';
  const name = document.createElement('span');
  name.textContent = label;
  const result = document.createElement('strong');
  result.textContent = String(value ?? '--');
  item.append(name, result);
  return item;
}

function formatForecastDuration(value) {
  return Number.isFinite(Number(value)) ? formatDuration(Number(value)) : 'Unavailable';
}

function renderMechanics(snapshot) {
  const compatibility = deriveStateCompatibility(snapshot);
  const compatibilityCard = document.querySelector('.compatibility-card');
  if (compatibilityCard) compatibilityCard.dataset.state = compatibility.state;
  text('stateCompatibilityState', compatibility.label);
  text('stateCompatibilityDetail', compatibility.detail);
  text('stateCompatibilitySchema', compatibility.schemaPath);
  text('stateCompatibilityIntegrity', compatibility.integrityState.replaceAll('_', ' '));
  text('stateCompatibilityAction', compatibility.nextAction.replaceAll('_', ' '));

  const performance = snapshot?.performanceBudget || {};
  const performanceCard = document.querySelector('.performance-budget-card');
  if (performanceCard) performanceCard.dataset.state = String(performance.state || 'healthy');
  text('performanceBudgetState', String(performance.state || 'healthy').replaceAll('_', ' '));
  text('performanceBudgetOperations', Object.values(performance.operations || {}).reduce((sum, value) => sum + Number(value || 0), 0));
  text('performanceBudgetBytes', formatBytes(performance.payloadBytes || 0));
  text('performanceBudgetCache', `${Number(performance.cacheHitRate ?? 100)}%`);

  const forecast = snapshot?.deliveryForecast || {};
  text('forecastRisk', String(forecast.risk || 'clear').replaceAll('_', ' '));
  text('forecastDrain', formatForecastDuration(forecast.drainEstimateMs));
  text('forecastP95', formatDuration(forecast.p95ProofMs || 0));
  text('forecastThroughput', `${Number(forecast.proofsPerMinute || 0).toFixed(2)} proofs/min`);

  const budget = snapshot?.recoveryBudget || {};
  text('recoveryBudgetState', String(budget.state || 'available').replaceAll('_', ' '));
  text('recoveryBudgetDetail', budget.state === 'exhausted'
    ? `Automatic repair is stopped until ${budget.cooldownUntil ? new Date(budget.cooldownUntil).toLocaleTimeString([], { hour12: false }) : 'manual reset'}.`
    : `${Number(budget.remaining ?? budget.maxAutomatic ?? 0)} of ${Number(budget.maxAutomatic || 0)} automatic repair attempts remain.`);

  byId('transportDrillReport').textContent = snapshot?.lastTransportDrill
    ? JSON.stringify(snapshot.lastTransportDrill, null, 2)
    : 'No drill has been run.';

  const index = buildTraceIndex(snapshot);
  const results = searchDeliveryTraces(index, state.traceQuery);
  if (!state.selectedTraceId || !results.some(item => item.traceId === state.selectedTraceId)) {
    state.selectedTraceId = results[0]?.traceId || '';
  }
  const container = byId('traceResults');
  container.replaceChildren();
  if (!results.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No delivery trace matches this search.';
    container.append(empty);
  } else {
    for (const item of results.slice(0, 80)) {
      const button = document.createElement('button');
      button.className = 'trace-result';
      button.dataset.traceId = item.traceId;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(item.traceId === state.selectedTraceId));
      const title = document.createElement('b');
      title.textContent = `Seq ${item.seq || '--'} - ${item.state || 'unknown'}`;
      const detail = document.createElement('small');
      detail.textContent = `${item.traceId} - ${item.envelopeId}${item.batchId ? ` - ${item.batchId}` : ''}`;
      button.append(title, detail);
      container.append(button);
    }
  }
  const selected = inspectDeliveryTrace(index.find(item => item.traceId === state.selectedTraceId));
  byId('traceDetail').textContent = selected ? JSON.stringify(selected, null, 2) : 'No trace selected.';
}
function renderReview(snapshot) {
  const review = deriveReview(snapshot);
  const grid = byId('reviewGrid');
  grid.replaceChildren(
    reviewItem('Company', review.context.company || 'Not provided'),
    reviewItem('Target role', review.context.targetRole || 'Not provided'),
    reviewItem('Round', review.context.interviewRound || 'Not provided'),
    reviewItem('Answer mode', review.context.answerMode || 'Not provided'),
    reviewItem('Questions observed', review.questions),
    reviewItem('Delivered', review.delivered),
    reviewItem('Delivery success', `${review.deliverySuccessRate}%`),
    reviewItem('Average proof', formatDuration(review.averageDeliveryProofMs)),
    reviewItem('Average answer', formatDuration(review.averageAnswerElapsedMs)),
    reviewItem('Answer timeouts', review.answerTimeouts)
  );
  renderMechanics(snapshot);
  byId('repairReport').textContent = snapshot?.lastRepair
    ? JSON.stringify(snapshot.lastRepair, null, 2)
    : 'No repair has been run.';
}

function updateControlAvailability() {
  const unavailable = !state.snapshot || state.sessionEnded;
  document.querySelectorAll('[data-command], #submitSelected, #archiveSelected, #archiveProven, #archiveAll, #copyLatest, #endSessionAction, #exportBeforeEnd, #archiveAndEnd, #cancelEndSession, #pinQuestion, #setQuestionPriority, #deferQuestion, #questionParentId, #linkQuestion, #undoQuestionAction').forEach(node => {
    const busy = node.dataset.busy === 'true';
    const commandBlocked = state.pending.size > 0 && Boolean(node.dataset.command);
    node.disabled = unavailable || busy || commandBlocked;
  });
  if (!unavailable) {
    const batch = state.snapshot?.batchState || {};
    const nextCount = Number(batch.next?.questionCount || batch.next?.memberIds?.length || 0);
    const active = Boolean(batch.active);
    const generating = Boolean(state.snapshot?.receiver?.generationState?.generating);
    byId('submitNow').disabled ||= !nextCount || active;
    byId('interruptLatest').disabled ||= !nextCount || !(active || generating);
    byId('copyLatest').disabled ||= !state.snapshot?.latestFinal?.text;
    byId('retryOutbox').disabled ||= deriveOutboxStatus(state.snapshot).count === 0;
    byId('compactProven').disabled ||= deriveMemoryGuard(state.snapshot).reclaimableBytes === 0;
    byId('submitSelected').disabled ||= !state.selectedQueueId;
    byId('archiveSelected').disabled ||= !state.selectedQueueId;
  }
  document.body.dataset.sessionEnded = state.sessionEnded ? 'true' : 'false';
}

function render(changedKeys = null) {
  const now = Date.now();
  const keys = changedKeys ? new Set(changedKeys) : null;
  const changed = (...values) => !keys || values.some(value => keys.has(value));
  renderOverview(state.snapshot, now);
  renderLiveOperations(state.snapshot, now);
  renderCommandPalette();
  if (changed('ledger', 'ledgerCounts', 'batchState', 'mode')) renderQueue(state.snapshot, now);
  if (changed('timeline')) renderTimeline(state.snapshot);
  if (changed('metrics', 'lastRepair', 'timeline', 'sender', 'receiver', 'ledger', 'deliveryForecast', 'recoveryBudget', 'lastTransportDrill')) renderReview(state.snapshot);
  updateControlAvailability();
}

async function runCommand(button, command, payload = {}) {
  if (state.sessionEnded) {
    showToast('This session has ended.', 'warn');
    return { ok: false, error: 'session_ended' };
  }
  const confirmation = button?.dataset?.confirm;
  if (confirmation && !globalThis.confirm(confirmation)) {
    return { ok: false, cancelled: true };
  }
  if (button) {
    button.dataset.busy = 'true';
    button.setAttribute('aria-busy', 'true');
  }
  updateControlAvailability();
  const result = await sendCommand(command, payload);
  if (button) {
    button.dataset.busy = 'false';
    button.removeAttribute('aria-busy');
  }
  updateControlAvailability();
  if (result?.ok) {
    showToast(commandResultLabel(command, result), 'ok');
  } else if (!result?.cancelled) {
    showToast(result?.error || `${command} failed`, 'error');
  }
  return result;
}

document.addEventListener('click', event => {
  const phaseButton = event.target.closest('[data-session-phase]');
  if (phaseButton) {
    void runCommand(phaseButton, 'set_session_phase', { phase: phaseButton.dataset.sessionPhase, reason: 'phase_navigator' });
    return;
  }
  const paletteResult = event.target.closest('[data-palette-index]');
  if (paletteResult) {
    state.commandPalette = { ...state.commandPalette, selectedIndex: Number(paletteResult.dataset.paletteIndex || 0) };
    renderCommandPalette();
    void executePaletteSelection();
    return;
  }
  if (event.target.closest('#openCommandPalette')) { openCommandPalette(event.target.closest('#openCommandPalette')); return; }
  if (event.target.closest('#closeCommandPalette')) { closeCommandPalette(); return; }
  const tab = event.target.closest('[data-view]');
  if (tab) {
    state.activeView = tab.dataset.view;
    document.querySelectorAll('[data-view]').forEach(node => {
      const active = node === tab;
      node.classList.toggle('active', active);
      node.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-view-panel]').forEach(node => {
      const active = node.dataset.viewPanel === state.activeView;
      node.classList.toggle('active', active);
      node.hidden = !active;
    });
    render();
    return;
  }
  const traceButton = event.target.closest('[data-trace-id]');
  if (traceButton) {
    state.selectedTraceId = traceButton.dataset.traceId || '';
    renderReview(state.snapshot);
    return;
  }
  const button = event.target.closest('[data-command]');
  if (button) {
    const command = button.dataset.command;
    const payload = command === 'set_auto_submit'
      ? { value: state.snapshot?.batchState?.autoSubmit === false }
      : command === 'set_hold'
        ? { value: !Boolean(state.snapshot?.batchState?.hold) }
        : command === 'set_focus_mode'
          ? { value: !Boolean(state.snapshot?.liveSession?.focusMode) }
          : {};
    void runCommand(button, command, payload);
  }
});

byId('exportSupportBundle').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.dataset.busy = 'true';
  button.setAttribute('aria-busy', 'true');
  updateControlAvailability();
  const result = await sendCommand('export_support_bundle');
  button.dataset.busy = 'false';
  button.removeAttribute('aria-busy');
  updateControlAvailability();
  if (!result?.ok || !result.bundle) {
    text('supportBundleStatus', result?.error || 'Support bundle export failed.');
    showToast(result?.error || 'Support bundle export failed.', 'error');
    return;
  }
  const blob = new Blob([`${JSON.stringify(result.bundle, null, 2)}
`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pmia-support-${sessionId.replace(/[^A-Za-z0-9_-]+/g, '_')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  text('supportBundleStatus', 'Metadata-only support bundle exported.');
  showToast('Safe support bundle downloaded.', 'ok');
});

byId('commandPaletteSearch').addEventListener('input', event => {
  state.commandPalette = { ...state.commandPalette, query: String(event.target.value || ''), selectedIndex: 0 };
  renderCommandPalette();
});
byId('phaseRail').addEventListener('keydown', event => {
  const result = handleToolbarKey(event.currentTarget, event, state.toolbarIndex);
  if (result.handled) state.toolbarIndex = result.activeIndex;
});

byId('traceSearch').addEventListener('input', event => {
  state.traceQuery = String(event.currentTarget.value || '');
  state.selectedTraceId = '';
  renderReview(state.snapshot);
});
byId('submitSelected').addEventListener('click', event => {
  if (!state.selectedQueueId) return showToast('Select an unresolved final.', 'warn');
  const item = state.snapshot?.ledger?.find(candidate => candidate.id === state.selectedQueueId);
  if (!['persisted', 'failed'].includes(item?.state)) return showToast('Only pending or failed finals can be submitted manually.', 'warn');
  void runCommand(event.currentTarget, 'submit_selected', { queueItemId: state.selectedQueueId });
});
byId('archiveSelected').addEventListener('click', event => {
  if (!state.selectedQueueId) return showToast('Select an unresolved final.', 'warn');
  void runCommand(event.currentTarget, 'archive_selected', { queueItemId: state.selectedQueueId });
});
byId('archiveProven').addEventListener('click', event => {
  void runCommand(event.currentTarget, 'archive_proven');
});
byId('archiveAll').addEventListener('click', event => {
  void runCommand(event.currentTarget, 'archive_all');
});
byId('copyLatest').addEventListener('click', async () => {
  const latest = String(state.snapshot?.latestFinal?.text || '').trim();
  if (!latest) return showToast('No latest question is available.', 'warn');
  try {
    await navigator.clipboard.writeText(latest);
    showToast('Latest question copied.', 'ok');
  } catch {
    showToast('Clipboard write failed.', 'error');
  }
});
function closeEndSheet() {
  byId('sessionEndSheet').hidden = true;
  state.endPreparation = null;
}

byId('endSessionAction').addEventListener('click', async () => {
  const prepared = await sendCommand('prepare_end_session');
  if (!prepared?.ok) return showToast(prepared?.error || 'Could not prepare session end.', 'error');
  state.endPreparation = prepared;
  if (prepared.canEnd) {
    const result = await sendCommand('end_session', { confirmToken: prepared.token, mode: 'clean' });
    if (!result?.ok) showToast(result?.error || 'End session failed.', 'error');
    return;
  }
  const view = deriveSessionEndView(prepared);
  text('sessionEndSummary', view.summary);
  text('endActionableCount', String(view.counts.actionable));
  text('endInFlightCount', String(view.counts.inFlight));
  text('endUnpersistedCount', String(view.counts.unpersisted));
  byId('sessionEndSheet').hidden = false;
});

byId('exportBeforeEnd').addEventListener('click', async () => {
  const result = await sendCommand('export_session');
  showToast(result?.ok ? 'Export scheduled.' : result?.error || 'Export failed.', result?.ok ? 'ok' : 'error');
});

byId('archiveAndEnd').addEventListener('click', async () => {
  const prepared = state.endPreparation;
  if (!prepared?.token) return closeEndSheet();
  if (!globalThis.confirm('Archive every unresolved final and end this session?')) return;
  const result = await sendCommand('end_session', { confirmToken: prepared.token, mode: 'archive_and_end' });
  if (!result?.ok) showToast(result?.error || 'End session failed.', 'error');
});
byId('cancelEndSession').addEventListener('click', closeEndSheet);

function selectedQuestion() {
  return state.snapshot?.questionOperationsDerived?.questions?.find(item => item.id === state.selectedQueueId) || null;
}

byId('questionSearch').addEventListener('input', event => {
  state.questionNavigator.query = String(event.target.value || '');
  renderQueue(state.snapshot, Date.now());
});
byId('questionGroup').addEventListener('change', event => {
  state.questionNavigator.group = event.target.value;
  renderQueue(state.snapshot, Date.now());
});
byId('questionPriority').addEventListener('change', event => {
  state.questionNavigator.priority = event.target.value;
  renderQueue(state.snapshot, Date.now());
});
byId('questionPinned').addEventListener('change', event => {
  state.questionNavigator.pinned = Boolean(event.target.checked);
  renderQueue(state.snapshot, Date.now());
});
byId('queueFilter').addEventListener('change', event => {
  state.queueFilter = event.target.value;
  renderQueue(state.snapshot, Date.now());
});

byId('pinQuestion').addEventListener('click', event => {
  const item = selectedQuestion();
  if (!item) return;
  void runCommand(event.currentTarget, 'set_question_pin', { itemId: item.id, value: !Boolean(item.operator?.pinned) });
});
byId('setQuestionPriority').addEventListener('change', event => {
  const item = selectedQuestion();
  if (!item) return;
  void runCommand(event.currentTarget, 'set_question_priority', { itemId: item.id, priority: event.target.value });
});
byId('deferQuestion').addEventListener('change', event => {
  const item = selectedQuestion();
  if (!item) return;
  const condition = event.target.value;
  const until = condition === 'until_time' ? Date.now() + 5 * 60_000 : 0;
  void runCommand(event.currentTarget, 'defer_question', { itemId: item.id, condition, until });
});
byId('linkQuestion').addEventListener('click', event => {
  const item = selectedQuestion();
  if (!item) return;
  void runCommand(event.currentTarget, 'link_question_follow_up', { itemId: item.id, parentId: byId('questionParentId').value });
});
byId('undoQuestionAction').addEventListener('click', event => {
  const undoId = event.currentTarget.dataset.undoId;
  if (undoId) void runCommand(event.currentTarget, 'undo_question_action', { undoId });
});
byId('timelineFilter').addEventListener('change', event => {
  state.timelineFilter = event.target.value;
  timelineViewport.scrollTop = 0;
  renderTimeline(state.snapshot);
});
timelineViewport.addEventListener('scroll', () => renderTimeline(state.snapshot), { passive: true });
byId('copyHealthReport').addEventListener('click', async () => {
  const report = JSON.stringify(buildSafeHealthReport(state.snapshot, Date.now(), state.efficiency), null, 2);
  try {
    await navigator.clipboard.writeText(report);
    showToast('Safe health report copied.', 'ok');
  } catch {
    showToast('Clipboard write failed.', 'error');
  }
});

byId('copyDiagnostics').addEventListener('click', async () => {
  const diagnostics = JSON.stringify(buildDiagnostics(state.snapshot), null, 2);
  try {
    await navigator.clipboard.writeText(diagnostics);
    showToast('Safe diagnostics copied.', 'ok');
  } catch {
    showToast('Clipboard write failed.', 'error');
  }
});

function commandButton(command) {
  return document.querySelector(`[data-command="${command}"]`);
}

function runKeyboardCommand(command) {
  return runCommand(commandButton(command), command);
}

document.addEventListener('keydown', event => {
  const paletteOpen = state.commandPalette.open;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    paletteOpen ? closeCommandPalette() : openCommandPalette(document.activeElement);
    return;
  }
  if (paletteOpen) {
    if (event.key === 'Escape') { event.preventDefault(); closeCommandPalette(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      state.commandPalette = movePaletteSelection(state.commandPalette, event.key === 'ArrowDown' ? 1 : -1);
      renderCommandPalette();
      return;
    }
    if (event.key === 'Enter') { event.preventDefault(); void executePaletteSelection(); return; }
    if (event.key === 'Tab') {
      const nodes = [...byId('commandPalette').querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(node => !node.hidden);
      if (nodes.length) {
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    return;
  }
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.target.matches('input,select,textarea,button')) return;
  const key = event.key.toLowerCase();
  if (key === ' ') {
    event.preventDefault();
    void runKeyboardCommand(state.snapshot?.mode === 'paused' ? 'resume_without_send' : 'pause');
  } else if (key === 'l') void runKeyboardCommand('resume_catch_up');
  else if (key === 'h') void runKeyboardCommand('check_live');
  else if (key === 'r') void runKeyboardCommand('repair_runtime');
  else if (key === 'e') void runKeyboardCommand('export_session');
  else if (key === 'm') void runKeyboardCommand('toggle_mic');
  else if (key === 's') void runKeyboardCommand('toggle_scroll');
  else if (key === 'n') void runKeyboardCommand('submit_now');
  else if (key === 'i') void runKeyboardCommand('interrupt_latest');
  else if (key === 'c') byId('copyLatest').click();
  else if (key === 'g') byId('copyHealthReport').click();
  else if (key === 'd') byId('copyDiagnostics').click();
});

setInterval(() => {
  if (state.snapshot) render();
}, 1000);

connect();
render();
