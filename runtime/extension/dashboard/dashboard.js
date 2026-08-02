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
import { deriveAnswerDeadlineView } from '../shared/answer-operations.js';
import { deriveShortcutHelp } from './shortcut-help-model.js';
import { applyAccessibilityPreferences, normalizeAccessibilityPreferences } from './accessibility-preferences.js';
import { createLiveAnnouncer } from './live-announcer.js';
import { createDialogFocusCoordinator } from './dialog-focus-coordinator.js';
import { normalizeShortcutBindings, resolveShortcutCommand } from '../shared/shortcut-bindings.js';
import { deriveManagedWindowModel } from './managed-window-model.js';
import { virtualItems } from './virtual-list-model.js';
import { createRenderScheduler } from './render-scheduler.js';
import { createIdleWorkCoordinator } from './idle-work-coordinator.js';
import { explainTrace } from '../shared/trace-explanation.js';
import { auditShortcutConflicts } from '../shared/shortcut-conflict-model.js';
import { auditDashboardAccessibility } from './accessibility-audit.js';
import { buildVisualPreferenceProof } from './visual-preference-proof.js';
import { deriveOperatingProfile } from '../shared/operating-profile.js';
import { buildPolicyImpactPreview, validatePolicyImpactConfirmation } from '../shared/policy-impact-preview.js';
import { renderLiveAssist } from './render-live-assist.js';

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
  toolbarIndex: 0,
  lastAnnouncement: '',
  interruptPlanDraft: null,
  productionProfileDraft: 'balanced',
  productionDecision: null,
  policyPreview: null,
  assistTriageView: 'urgent',
  assistCommandQuery: '',
  assistWizardStage: 'start'
};

const byId = id => document.getElementById(id);
const connectionState = byId('connectionState');
const toast = byId('toast');
const timelineViewport = byId('timelineViewport');
const timelineCanvas = byId('timelineCanvas');
const dialogFocus = createDialogFocusCoordinator();
const liveAnnouncer = createLiveAnnouncer({ politeNode: byId('screenReaderPolite'), assertiveNode: byId('screenReaderAssertive') });
let shortcutBindings = normalizeShortcutBindings();
const idleWork = createIdleWorkCoordinator();
const renderScheduler = createRenderScheduler();

function setConnection(label, tone = 'warn') {
  connectionState.dataset.tone = tone;
  connectionState.querySelector('span:last-child').textContent = label;
}

function showToast(message, tone = 'info') {
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add('show');
  if (state.snapshot?.uiPreferences?.accessibility?.announcements !== false) {
    liveAnnouncer.announce(message, { priority: ['error', 'warn'].includes(tone) ? 'assertive' : 'polite' });
  }
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
    scheduleRender();
    return;
  }
  if (message?.type === 'PMIA_DASHBOARD_DELTA' && state.snapshot) {
    state.snapshot = applySnapshotDelta(state.snapshot, message.delta);
    state.efficiency.delta += 1;
    state.efficiency.lastMode = 'Delta';
    state.efficiency.changedSections = message.delta?.keys?.length || 0;
    setConnection('Live', 'ok');
    scheduleRender(message.delta?.keys || []);
    return;
  }
  if (message?.type === 'PMIA_DASHBOARD_SESSION_ENDED') {
    state.sessionEnded = true;
    state.snapshot = null;
    failPendingCommands('session_ended');
    clearTimeout(state.reconnectTimer);
    setConnection('Session ended', 'error');
    scheduleRender();
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
    scheduleRender([message.role]);
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



function renderPreflightAndCrash(snapshot, now = Date.now()) {
  const preflight = snapshot?.preflightWizard || { completed: 0, total: 0, ready: false, current: null };
  const runbookProgress = byId('runbookProgress');
  if (runbookProgress && preflight.total) runbookProgress.title = `${preflight.completed} of ${preflight.total} preflight checks complete`;
  const crash = snapshot?.crashResume || { visible: false };
  const card = byId('crashResumeCard');
  card.hidden = !crash.visible;
  if (crash.visible) {
    text('crashResumeTitle', crash.reason === 'managed_role_restarted' ? 'Managed role restarted' : 'Runtime interruption detected');
    text('crashResumeDetail', `${crash.unresolved || 0} protected final${crash.unresolved === 1 ? '' : 's'} retained. Checkpoint age ${formatDuration(crash.checkpointAgeMs || 0)}.`);
    byId('resumeLiveSession').disabled = snapshot?.resumeGuard?.allowed === false;
  }
}

function renderAccessibility(snapshot) {
  shortcutBindings = normalizeShortcutBindings(snapshot?.uiPreferences?.shortcutBindings || shortcutBindings);
  const prefs = applyAccessibilityPreferences(document.documentElement, snapshot?.uiPreferences?.accessibility || {});
  document.querySelectorAll('[data-accessibility-name]').forEach(node => { node.value = String(prefs[node.dataset.accessibilityName] || ''); });
  if (byId('reducedMotionPreference')) byId('reducedMotionPreference').value = prefs.reducedMotion;
  if (byId('textScalePreference')) byId('textScalePreference').value = prefs.textScale;
  if (byId('contrastPreference')) byId('contrastPreference').value = prefs.contrast;
  const list = byId('shortcutHelpGroups');
  if (!list) return;
  list.replaceChildren();
  for (const group of deriveShortcutHelp(shortcutBindings, commandCatalog(snapshot || {})).groups) {
    const section = document.createElement('section'); section.className = 'shortcut-group';
    const heading = document.createElement('h3'); heading.textContent = group.name; section.append(heading);
    for (const item of group.rows) {
      const row = document.createElement('div'); row.className = 'shortcut-row';
      const label = document.createElement('label'); label.textContent = item.label; label.htmlFor = `shortcut-${item.command}`;
      const input = document.createElement('input'); input.id = `shortcut-${item.command}`; input.value = item.chord; input.dataset.shortcutCommand = item.command;
      const save = document.createElement('button'); save.textContent = 'Save'; save.dataset.saveShortcut = item.command;
      row.append(label, input, save); section.append(row);
    }
    list.append(section);
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

function renderIncidentCenter(snapshot, now) {
  const model = snapshot?.incidents || { items: [], quietMode: false, hiddenCount: 0, currentRunbook: null };
  const items = Array.isArray(model.items) ? model.items.filter(item => item.visible !== false && Number(item.snoozedUntil || 0) <= now) : [];
  text('incidentCenterTitle', items.length ? `${items.length} active incident${items.length === 1 ? '' : 's'}` : 'No active incidents');
  text('incidentCenterSummary', model.quietMode
    ? `Quiet mode is on. ${Number(model.hiddenCount || 0)} lower-priority incident${Number(model.hiddenCount || 0) === 1 ? '' : 's'} hidden.`
    : 'Incidents are ordered by severity and owning subsystem.');
  const quiet = byId('quietAttentionAction');
  quiet.textContent = `Quiet mode: ${model.quietMode ? 'On' : 'Off'}`;
  quiet.setAttribute('aria-pressed', String(Boolean(model.quietMode)));
  const list = byId('incidentList');
  list.replaceChildren();
  for (const incident of items.slice(0, 8)) {
    const row = document.createElement('li');
    row.className = 'incident-item';
    row.dataset.severity = incident.severity || 'warn';
    row.dataset.acknowledged = String(Boolean(incident.acknowledgedAt));
    const copy = document.createElement('div');
    copy.className = 'incident-copy';
    const title = document.createElement('strong');
    title.textContent = humanizeCode(incident.code);
    const meta = document.createElement('div');
    meta.className = 'incident-meta';
    const age = Math.max(0, now - Number(incident.firstSeenAt || now));
    meta.textContent = `${humanizeCode(incident.owner)}${incident.role ? ` / ${humanizeCode(incident.role)}` : ''} · ${humanizeCode(incident.severity)} · ${formatDuration(age)}`;
    copy.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'incident-actions';
    if (!incident.acknowledgedAt) {
      const acknowledge = document.createElement('button');
      acknowledge.textContent = 'Acknowledge';
      acknowledge.dataset.incidentAction = 'acknowledge';
      acknowledge.dataset.incidentId = incident.id;
      actions.append(acknowledge);
    }
    const snooze = document.createElement('button');
    snooze.textContent = 'Snooze 5m';
    snooze.dataset.incidentAction = 'snooze';
    snooze.dataset.incidentId = incident.id;
    actions.append(snooze);
    row.append(copy, actions);
    list.append(row);
  }
  const runbook = model.currentRunbook;
  const runbookNode = byId('incidentRunbook');
  runbookNode.hidden = !runbook?.current;
  if (runbook?.current) {
    text('incidentRunbookStep', `${runbook.currentIndex + 1} / ${runbook.steps.length} · ${runbook.current.label}`);
    const action = byId('incidentRunbookAction');
    action.hidden = !runbook.current.command;
    action.dataset.command = runbook.current.command || '';
    action.textContent = runbook.current.command ? 'Run current step' : 'Operator action required';
  }
}

function renderManagedWindowNavigator(snapshot) {
  const model = deriveManagedWindowModel(snapshot);
  text('managedWindowState', model.description);
  const back = byId('focusBackAction');
  back.disabled = !model.canGoBack;
  for (const item of model.targets) {
    const node = byId(`focus${item.target[0].toUpperCase()}${item.target.slice(1)}Action`);
    if (!node) continue;
    node.setAttribute('aria-pressed', String(item.focused));
    node.classList.toggle('active', item.focused);
  }
}

function renderRecoveryCard(snapshot) {
  const model = snapshot?.recoveryCard || { visible: false };
  const card = byId('interruptionRecoveryCard');
  card.hidden = !model.visible;
  if (!model.visible) return;
  const checkpoint = model.checkpoint || {};
  text('recoveryCheckpointTitle', `${humanizeCode(checkpoint.phase || 'session')} checkpoint · ${model.retainedFinals || 0} retained final${model.retainedFinals === 1 ? '' : 's'}`);
  text('recoveryCheckpointDetail', model.current
    ? `${model.current.label}. Checkpoint age ${formatDuration(model.ageMs || 0)}.`
    : 'Inspect the current runtime before resuming.');
  const action = byId('recoveryCheckpointAction');
  action.hidden = !model.current?.command;
  action.dataset.command = model.current?.command || '';
  action.textContent = model.current?.command === 'resume_checkpoint' ? 'Resume checkpoint' : 'Run recovery step';
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
  const announcement = `${humanizeCode(phase.state || 'setup')}: ${attention.title || humanizeCode(attention.reason || 'caught up')}`;
  if (announcement !== state.lastAnnouncement && state.snapshot?.uiPreferences?.accessibility?.announcements !== false) {
    state.lastAnnouncement = announcement;
    liveAnnouncer.announce(announcement, { priority: ['critical','error'].includes(attention.severity) ? 'assertive' : 'polite' });
  }
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
  renderIncidentCenter(snapshot, now);
  renderManagedWindowNavigator(snapshot);
  renderRecoveryCard(snapshot);
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
  dialogFocus.open(byId('commandPalette'), trigger);
  queueMicrotask(() => byId('commandPaletteSearch').focus());
}

function closeCommandPalette() {
  state.commandPalette = { ...state.commandPalette, open: false };
  renderCommandPalette();
  dialogFocus.close(byId('commandPalette'));
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

function renderBatchPreview(snapshot) {
  const preview = snapshot?.batchPreview || {};
  const active = preview.active;
  const next = preview.next;
  text('activeBatchPreview', active ? `${active.count} question${active.count === 1 ? '' : 's'} · ${active.totalChars} chars` : 'No active batch');
  text('activeBatchMembers', active?.memberIds?.length ? active.memberIds.join(' · ') : 'No members.');
  text('nextBatchPreview', next ? `${next.count} protected question${next.count === 1 ? '' : 's'} · ${next.totalChars} chars` : 'Nothing waiting');
  text('nextBatchMembers', next?.memberIds?.length ? next.memberIds.join(' · ') : 'No members.');
  const budget = preview.budget;
  text('batchBudgetPreview', budget ? `${budget.maxMembers} questions / ${budget.maxChars} chars` : 'No budget evidence');
  text('batchPolicyPreview', `${preview.sequencePreserved === false ? 'Sequence warning' : 'Sequence preserved'} · ${preview.hold ? 'Hold on' : preview.autoSubmit ? 'Auto-submit on' : 'Manual submit'}`);
}

function renderReceiverFlow(snapshot, now = Date.now()) {
  const batch = snapshot?.batchState || {};
  const policy = batch.receiverPolicy || {};
  const deadline = deriveAnswerDeadlineView(snapshot?.answerState || {}, now);
  const mode = policy.pauseAfterAnswer ? 'Pause after answer' : policy.drainMode === 'all' ? 'Drain all' : policy.drainMode === 'one' ? `Drain ${policy.drainRemaining || 1}` : policy.submitOnIdle ? 'Submit on idle' : 'Automatic';
  text('receiverPolicyState', mode);
  text('receiverPolicyDetail', batch.preview?.next?.count ? `${batch.preview.next.count} protected question${batch.preview.next.count === 1 ? '' : 's'} in ${batch.preview.next.partitionCount || 1} partition${batch.preview.next.partitionCount === 1 ? '' : 's'}.` : 'No protected batch is waiting.');
  text('answerDeadlineState', deadline.terminal ? humanizeCode(deadline.state) : deadline.deadlineAt ? `${humanizeCode(deadline.state)} · ${formatDuration(deadline.remainingMs)}` : humanizeCode(deadline.state));
  const handoff = batch.answerHandoff;
  text('answerHandoffState', handoff ? `${humanizeCode(handoff.state)} · ${handoff.memberCount || 0} question${handoff.memberCount === 1 ? '' : 's'} · ${handoff.proofVerified ? 'proof verified' : 'proof pending'}` : 'No completed answer handoff.');
  byId('pauseAfterAnswer').textContent = policy.pauseAfterAnswer ? 'Disable pause after answer' : 'Pause after answer';
  byId('submitOnIdle').textContent = policy.submitOnIdle ? 'Disable submit on idle' : 'Submit on idle';
  const noResponse = Boolean(batch.pendingNoResponse);
  for (const id of ['resolveNoResponseWait','resolveNoResponseRetry','resolveNoResponseContinue']) byId(id).hidden = !noResponse;
  byId('acknowledgeAnswer').disabled = !batch.answerAcknowledgement || batch.answerAcknowledgement.acknowledged;
  const plan = state.interruptPlanDraft || batch.interruptPlan || null;
  byId('confirmInterrupt').hidden = !plan?.ok;
  text('interruptPreviewState', plan?.ok ? `Interrupt latest #${plan.latestSeq || '--'}; preserve ${plan.preservedIds?.length || 0} waiting question${plan.preservedIds?.length === 1 ? '' : 's'}.` : 'No interrupt is prepared.');
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
  renderBatchPreview(snapshot);
  renderReceiverFlow(snapshot, now);
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
  const queueVirtual = virtualItems(navigator.results, { scrollTop: 0, viewportHeight: 5760, rowHeight: 48, overscan: 8 });
  const inbox = queueVirtual.items;
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

function renderLandmarks(snapshot) {
  const container = byId('landmarkList');
  container.replaceChildren();
  const values = Array.isArray(snapshot?.sessionLandmarks) ? snapshot.sessionLandmarks.slice(-24) : [];
  if (!values.length) {
    const empty = document.createElement('span');
    empty.className = 'empty';
    empty.textContent = 'No interview landmarks yet.';
    container.append(empty);
    return;
  }
  for (const landmark of values) {
    const chip = document.createElement('span');
    chip.className = 'landmark-chip';
    chip.title = landmark.targetId || landmark.category;
    const label = document.createElement('span');
    label.textContent = `${new Date(landmark.at).toLocaleTimeString([], { hour12: false })} · ${humanizeCode(landmark.category)}`;
    chip.append(label);
    if (landmark.source === 'operator') {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${humanizeCode(landmark.category)} marker`);
      remove.dataset.markerRemove = landmark.id;
      chip.append(remove);
    }
    container.append(chip);
  }
}

function renderTimeline(snapshot) {
  renderLandmarks(snapshot);
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

  const mechanics = snapshot?.mechanicsHardening || {};
  const mechanicsIssues = [mechanics.prerender?.blocked, mechanics.selectorDrift?.critical?.length, mechanics.partialProof?.missingIds?.length, mechanics.isolation?.issues?.length, mechanics.reasonCodes?.unknown?.length, mechanics.architectureBudget?.violations?.length].filter(Boolean).length;
  text('mechanicsHardeningState', mechanicsIssues ? 'Attention' : 'Healthy');
  text('mechanicsHardeningDetail', `${mechanicsIssues} active hardening issue(s) ? ${mechanics.selectorSurfaces || 0} selector surface(s) ? ${mechanics.starvation?.promotedCount || 0} promoted partition(s).`);

  const shortcutAudit = auditShortcutConflicts(snapshot?.uiPreferences?.shortcutBindings || {});
  const accessibilityAudit = auditDashboardAccessibility(document);
  const visualProof = buildVisualPreferenceProof({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, preferences: snapshot?.uiPreferences?.accessibility || {}, controlsVisible: document.querySelectorAll('button:not([hidden])').length, dialogs: document.querySelectorAll('[role="dialog"],dialog').length });
  text('liveIntegrityState', humanizeCode(snapshot?.liveCommandIntegrity?.state || 'unknown'));
  text('liveIntegrityDetail', `${snapshot?.liveCommandIntegrity?.issues?.length || 0} metadata issue(s) ? ${shortcutAudit.issues.length} shortcut conflict(s) ? ${accessibilityAudit.issues.length} accessibility issue(s) ? ${visualProof.reflow ? 'reflow clear' : `${visualProof.overflowPx}px overflow`}.`);

  const uxBudget = snapshot?.liveUxBudget || {};
  text('liveUxBudgetState', humanizeCode(uxBudget.state || 'unknown'));
  text('liveUxBudgetDetail', uxBudget.breaches?.length ? uxBudget.breaches.map(item => `${item.key} ${item.value}/${item.limit}`).join(' · ') : 'All live cockpit collections are within budget.');

  const operational = snapshot?.operationalReview || {};
  const health = operational.performanceHealth || {};
  const healthCard = document.querySelector('.operational-health-card');
  if (healthCard) healthCard.dataset.state = health.state || 'unknown';
  text('operationalHealthState', humanizeCode(health.state || 'unknown'));
  text('operationalHealthDetail', health.userImpact ? 'Current performance evidence can affect delivery or operator response.' : health.issues?.length ? `${health.issues.length} condition(s) should be watched.` : 'No user-impacting performance issue is detected.');
  text('sloTrendState', humanizeCode(operational.sloTrend?.state || 'unknown'));
  text('commitWaitState', formatDuration(health.commitWaitMs || 0));
  text('operationalCacheState', `${Math.round(Number(health.cacheHitRate ?? 1) * 100)}%`);
  const runbook = operational.stabilization;
  text('stabilizationState', humanizeCode(runbook?.state || 'not_started'));
  const currentStep = runbook?.steps?.[runbook.current || 0];
  text('stabilizationDetail', currentStep ? `Current: ${humanizeCode(currentStep.id)} (${Number(runbook.current || 0) + 1}/${runbook.steps.length}).` : runbook?.state === 'complete' ? 'All stabilization checks completed.' : 'Start only when runtime evidence needs stabilization.');

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
  byId('traceDetail').textContent = selected ? JSON.stringify({ ...selected, explanation: explainTrace(selected) }, null, 2) : 'No trace selected.';
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

function replaceTextList(id, items = [], formatter = value => String(value)) {
  const root = byId(id);
  if (!root) return;
  root.replaceChildren();
  for (const item of items.slice(0, 20)) {
    const node = document.createElement('li');
    node.textContent = formatter(item);
    root.append(node);
  }
}

function activateDashboardView(view, anchor = '', reason = 'operator_navigation') {
  const tab = document.querySelector(`[data-view="${CSS.escape(String(view || 'overview'))}"]`);
  if (!tab) return false;
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
  scheduleRender();
  requestAnimationFrame(() => {
    const target = anchor ? byId(anchor) : null;
    target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    target?.focus?.({ preventScroll: true });
  });
  void sendCommand('record_production_navigation', { route: { view: state.activeView, anchor, reason } });
  return true;
}

function renderProduction(snapshot) {
  const production = snapshot?.production || {};
  const diagnostics = production.diagnostics || {};
  const badge = byId('productionHealthBadge');
  if (badge) { badge.dataset.state = diagnostics.state || 'unknown'; badge.textContent = diagnostics.score == null ? 'Waiting' : `${diagnostics.score}/100`; }
  const center = production.decisionCenter || { items: [], count: 0, primary: null };
  state.productionDecision = center.primary || null;
  text('productionDecisionTitle', center.primary?.title || 'No action required');
  text('productionDecisionDetail', center.primary?.detail || 'The live system is caught up.');
  text('productionDecisionCount', String(center.count || 0));
  const action = byId('productionDecisionAction');
  if (action) {
    const mode = center.primary?.actionMode || (center.primary?.command ? 'execute' : 'inspect');
    action.hidden = !center.primary;
    action.dataset.actionMode = mode;
    action.textContent = mode === 'choose' ? 'Choose an option' : mode === 'inspect' ? 'Inspect evidence' : `Run ${humanizeCode(center.primary?.command)}`;
  }
  replaceTextList('productionDecisionList', center.items || [], item => `${String(item.severity || 'info').toUpperCase()} · ${item.title}`);

  const selected = document.activeElement === byId('operatingProfileSelect')
    ? byId('operatingProfileSelect').value
    : (state.productionProfileDraft || snapshot?.productionControls?.operatingProfile || production.operatingProfile?.id || 'balanced');
  state.productionProfileDraft = selected;
  if (byId('operatingProfileSelect') && document.activeElement !== byId('operatingProfileSelect')) byId('operatingProfileSelect').value = selected;
  const profile = deriveOperatingProfile(snapshot || {}, selected);
  text('operatingProfileDescription', `${profile.description} ${profile.eligibility.allowed ? '' : `Blocked: ${profile.eligibility.blockers.map(humanizeCode).join(', ')}.`}`.trim());
  replaceTextList('operatingProfileChanges', profile.changes || [], item => `${humanizeCode(item.field)}: ${String(item.from)} -> ${String(item.to)}`);
  byId('applyOperatingProfile').disabled = !profile.eligibility.allowed || profile.changes.length === 0;

  const containment = production.containment || {};
  text('containmentState', humanizeCode(containment.state || 'waiting'));
  text('containmentDetail', `${humanizeCode(containment.reason || 'no evidence')}${containment.overrideActive ? ` · override until ${new Date(containment.overrideUntil).toLocaleTimeString()}` : ''}`);
  const override = byId('containmentOverride');
  if (override) { override.disabled = !containment.overrideActive && !containment.overrideEligible; override.textContent = containment.overrideActive ? 'End override' : 'Start 2-minute override'; }
  byId('containmentState')?.closest('.production-card')?.setAttribute('data-state', containment.state || 'unknown');

  const transport = production.transportAssurance || {};
  text('transportAssuranceState', `${humanizeCode(transport.state || 'waiting')} · ${Number(transport.score || 0)}/100`);
  text('transportAssuranceDetail', transport.nextProbeAt > Date.now() ? `Next safe probe in ${formatDuration(transport.nextProbeAt - Date.now())}.` : 'Active no-content probe is available.');
  text('transportSenderState', `${humanizeCode(transport.sender?.mode || 'unknown')} · ${transport.sender?.rttMs || 0} ms`);
  text('transportReceiverState', `${humanizeCode(transport.receiver?.mode || 'unknown')} · ${transport.receiver?.rttMs || 0} ms`);
  text('transportCorrelationGaps', String(transport.correlationGaps || 0));

  const route = production.routeReadiness || {};
  text('routeReadinessState', `${humanizeCode(route.state || 'waiting')} · ${route.route || '--'}`);
  text('routeReadinessDetail', route.blockers?.length ? route.blockers.map(humanizeCode).join(' · ') : 'All route checks passed.');
  replaceTextList('routeChecklist', route.checklist || [], item => `${item.ok ? 'PASS' : 'WAIT'} · ${item.label}`);

  const upgrade = production.upgradeReadiness || {};
  text('upgradeReadinessState', humanizeCode(upgrade.state || 'waiting'));
  text('upgradeReadinessDetail', `${upgrade.unresolved || 0} unresolved · ${upgrade.inFlight || 0} in flight · storage ${humanizeCode(upgrade.storageLevel || 'unknown')} · rollback ${upgrade.rollbackReady ? 'ready' : 'missing'}`);
  replaceTextList('upgradeBlockers', upgrade.blockers || [], humanizeCode);

  const score = production.scorecard || {};
  text('liveScoreValue', score.score == null ? '--' : String(score.score));
  text('scoreDelivery', `${score.deliverySuccessRate ?? '--'}%`);
  text('scoreAnswers', `${score.answerAvailabilityRate ?? '--'}%`);
  text('scoreMarkers', String(score.markerTotal || 0));
  text('scoreFollowUps', String(score.followUps || 0));
  text('scorecardDetail', `${score.phaseCount || 0} phase${score.phaseCount === 1 ? '' : 's'} · ${score.questionsObserved || 0} questions · ${score.unresolved || 0} unresolved · review ${score.reviewReady ? 'ready' : 'not ready'}`);

  text('productionDiagnosticsState', `${humanizeCode(diagnostics.state || 'waiting')} · ${diagnostics.score ?? 0}/100`);
  text('productionDiagnosticsDetail', diagnostics.supportComplete ? 'Support metadata is complete and privacy bounded.' : `Missing: ${(diagnostics.missingSections || []).map(humanizeCode).join(', ')}`);
  text('productionFingerprint', JSON.stringify(diagnostics.fingerprint || {}, null, 2));

  const release = production.releaseHandoff || {};
  text('releaseHandoffState', humanizeCode(release.state || 'not_ready'));
  replaceTextList('releaseGateList', release.gates || [], item => `${item.ok ? 'PASS' : 'WAIT'} · ${humanizeCode(item.id)}${item.detail ? ` · ${item.detail}` : ''}`);
  byId('downloadHandoffManifest').disabled = !snapshot;
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
  renderAccessibility(state.snapshot);
  renderPreflightAndCrash(state.snapshot, now);
  renderProduction(state.snapshot);
  renderLiveAssist({ document, snapshot: state.snapshot, state, now });
  renderCommandPalette();
  if (changed('ledger', 'ledgerCounts', 'batchState', 'mode')) renderQueue(state.snapshot, now);
  if (changed('timeline')) renderTimeline(state.snapshot);
  if (changed('metrics', 'lastRepair', 'timeline', 'sender', 'receiver', 'ledger', 'deliveryForecast', 'recoveryBudget', 'lastTransportDrill')) renderReview(state.snapshot);
  updateControlAvailability();
}

function scheduleRender(changedKeys = null) {
  const sections = Array.isArray(changedKeys) ? changedKeys : changedKeys ? [...changedKeys] : ['all'];
  renderScheduler.schedule(sections, pending => render(pending.includes('all') ? null : pending));
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
  const focusCommands = {
    focus_sender: { target: 'sender', action: 'focus' },
    focus_receiver: { target: 'receiver', action: 'focus' },
    focus_pilot: { target: 'pilot', action: 'focus' },
    focus_back: { target: 'previous', action: 'back' },
    spotlight_sender: { target: 'sender', action: 'spotlight' },
    spotlight_receiver: { target: 'receiver', action: 'spotlight' },
    spotlight_pilot: { target: 'pilot', action: 'spotlight' }
  };
  if (focusCommands[command] && !payload.focusIntent) {
    payload = { ...payload, focusIntent: issueFocusGesture({ sessionId, ...focusCommands[command] }) };
  }
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
  const shortcutHelpTrigger = event.target.closest('#openShortcutHelp, #openShortcutHelpFooter');
  if (shortcutHelpTrigger) { renderAccessibility(state.snapshot); dialogFocus.open(byId('shortcutHelpDialog'), shortcutHelpTrigger); return; }
  if (event.target.closest('#closeShortcutHelp')) { dialogFocus.close(byId('shortcutHelpDialog')); return; }
  const saveShortcut = event.target.closest('[data-save-shortcut]');
  if (saveShortcut) {
    const commandId = saveShortcut.dataset.saveShortcut || '';
    const input = byId(`shortcut-${commandId}`);
    void runCommand(saveShortcut, 'set_shortcut_binding', { commandId, chord: input?.value || '' }).then(result => {
      text('shortcutPreferenceStatus', result?.ok ? `${humanizeCode(commandId)} now uses ${result.chord}.` : humanizeCode(result?.error || 'shortcut_update_failed'));
      if (result?.ok) renderAccessibility({ ...state.snapshot, uiPreferences: { ...(state.snapshot?.uiPreferences || {}), shortcutBindings: result.bindings } });
    });
    return;
  }
  if (event.target.closest('#resetShortcutBindings')) {
    const button = event.target.closest('#resetShortcutBindings');
    void runCommand(button, 'reset_shortcut_bindings').then(result => {
      if (result?.ok) renderAccessibility({ ...state.snapshot, uiPreferences: { ...(state.snapshot?.uiPreferences || {}), shortcutBindings: result.bindings } });
    });
    return;
  }
  if (event.target.closest('#closeCommandPalette')) { closeCommandPalette(); return; }
  const tab = event.target.closest('[data-view]');
  if (tab) {
    activateDashboardView(tab.dataset.view, '', 'tab_click');
    return;
  }
  const traceButton = event.target.closest('[data-trace-id]');
  if (traceButton) {
    state.selectedTraceId = traceButton.dataset.traceId || '';
    renderReview(state.snapshot);
    return;
  }
  const markerButton = event.target.closest('[data-marker-category]');
  if (markerButton) {
    const targetId = state.selectedQueueId || 'session';
    const targetType = state.selectedQueueId ? 'envelope' : 'session';
    void runCommand(markerButton, 'add_marker', {
      category: markerButton.dataset.markerCategory,
      targetType,
      targetId
    });
    return;
  }
  const markerRemove = event.target.closest('[data-marker-remove]');
  if (markerRemove) {
    void runCommand(markerRemove, 'remove_marker', { markerId: markerRemove.dataset.markerRemove || '' });
    return;
  }
  const incidentButton = event.target.closest('[data-incident-action]');
  if (incidentButton) {
    const action = incidentButton.dataset.incidentAction;
    const command = action === 'acknowledge' ? 'acknowledge_incident'
      : action === 'snooze' ? 'snooze_incident'
        : 'clear_incident';
    const payload = {
      incidentId: incidentButton.dataset.incidentId || '',
      ...(action === 'snooze' ? { durationMs: 300000 } : {})
    };
    void runCommand(incidentButton, command, payload);
    return;
  }
  const dockAction = event.target.closest('#dockPrimaryAction');
  if (dockAction) {
    const mode = dockAction.dataset.actionMode || 'inspect';
    if (mode === 'execute' && dockAction.dataset.command) void runCommand(dockAction, dockAction.dataset.command);
    else activateDashboardView(dockAction.dataset.view || 'assist', dockAction.dataset.anchor || 'choiceWorkspace', 'action_dock');
    return;
  }
  const choiceOption = event.target.closest('[data-choice-option]');
  if (choiceOption) {
    void runCommand(choiceOption, 'resolve_operator_choice', { choiceId:choiceOption.dataset.choiceId || '', fingerprint:choiceOption.dataset.fingerprint || '', option:choiceOption.dataset.choiceOption || '' });
    return;
  }
  const milestone = event.target.closest('[data-milestone]');
  if (milestone) { activateDashboardView('timeline', '', `milestone:${milestone.dataset.milestone}`); return; }
  const triage = event.target.closest('[data-triage-view]');
  if (triage) { state.assistTriageView = triage.dataset.triageView || 'urgent'; renderLiveAssist({ document, snapshot:state.snapshot, state, now:Date.now() }); return; }
  const undo = event.target.closest('[data-undo-id]');
  if (undo) { void runCommand(undo, 'undo_question_action', { undoId:undo.dataset.undoId || '' }); return; }
  const previewProfile = event.target.closest('#assistPreviewSafe, #assistPreviewBalanced, #assistPreviewFast, #assistForecastAction');
  if (previewProfile) {
    const profile = previewProfile.dataset.profile || previewProfile.id.replace('assistPreview','').toLowerCase();
    state.policyPreview = buildPolicyImpactPreview(state.snapshot || {}, { kind:'operating_profile', profile }, Date.now());
    renderLiveAssist({ document, snapshot:state.snapshot, state, now:Date.now() });
    return;
  }
  if (event.target.closest('#assistPolicyConfirm')) {
    const validation = validatePolicyImpactConfirmation(state.snapshot || {}, state.policyPreview, Date.now());
    if (!validation.ok) { showToast(validation.error, 'error'); state.policyPreview=null; scheduleRender(); return; }
    const preview=validation.preview; const command=preview.kind==='operating_profile'?'apply_operating_profile':'set_containment_override';
    const payload=preview.kind==='operating_profile'?{ profile:preview.target }:{ enabled:preview.target==='enable', durationMs:120000, reason:'policy_preview' };
    void runCommand(event.target.closest('#assistPolicyConfirm'),command,payload).then(result=>{ if(result?.ok) state.policyPreview=null; scheduleRender(); });
    return;
  }
  if (event.target.closest('#assistWizardStart')) { state.assistWizardStage='start'; scheduleRender(); return; }
  if (event.target.closest('#assistWizardEnd')) { state.assistWizardStage='end'; scheduleRender(); return; }
  const button = event.target.closest('[data-command]');
  if (button) {
    const command = button.dataset.command;
    const payload = command === 'set_auto_submit'
      ? { value: state.snapshot?.batchState?.autoSubmit === false }
      : command === 'set_hold'
        ? { value: !Boolean(state.snapshot?.batchState?.hold) }
        : command === 'set_focus_mode'
          ? { value: !Boolean(state.snapshot?.liveSession?.focusMode) }
          : command === 'set_quiet_mode'
            ? { value: !Boolean(state.snapshot?.incidents?.quietMode) }
            : {};
    void runCommand(button, command, payload);
  }
});

byId('operatingProfileSelect').addEventListener('change', event => {
  state.productionProfileDraft = event.currentTarget.value;
  renderProduction(state.snapshot);
});
byId('applyOperatingProfile').addEventListener('click', () => {
  const profile = byId('operatingProfileSelect').value;
  state.policyPreview = buildPolicyImpactPreview(state.snapshot || {}, { kind:'operating_profile', profile }, Date.now());
  activateDashboardView('assist', 'assistPolicyTitle', 'profile_impact_preview');
  scheduleRender();
});
byId('containmentOverride').addEventListener('click', () => {
  const current = state.snapshot?.production?.containment || {};
  state.policyPreview = buildPolicyImpactPreview(state.snapshot || {}, { kind:'containment_override', enabled:!Boolean(current.overrideActive) }, Date.now());
  activateDashboardView('assist', 'assistPolicyTitle', 'containment_impact_preview');
  scheduleRender();
});
byId('productionDecisionAction').addEventListener('click', event => {
  const decision = state.productionDecision;
  if (!decision) return;
  const mode = decision.actionMode || (decision.command ? 'execute' : 'inspect');
  if (mode === 'execute' && decision.command) {
    void runCommand(event.currentTarget, decision.command, decision.payload || {});
    return;
  }
  activateDashboardView(decision.view || 'overview', decision.anchor || 'readinessGate', decision.code || 'decision_navigation');
});
byId('productionNavigate').addEventListener('click', () => {
  const route = state.snapshot?.production?.navigation?.route || { view: 'overview', anchor: 'readinessGate', reason: 'production_navigation' };
  activateDashboardView(route.view, route.anchor, route.reason);
});
byId('copyEscalationSummary').addEventListener('click', async () => {
  const summary = String(state.snapshot?.production?.diagnostics?.escalationSummary || '');
  if (!summary) return showToast('No escalation summary is available.', 'warn');
  try { await navigator.clipboard.writeText(summary); showToast('Escalation summary copied.', 'ok'); }
  catch { showToast('Clipboard write failed.', 'error'); }
});
byId('downloadHandoffManifest').addEventListener('click', () => {
  const snapshot = state.snapshot || {};
  const production = snapshot.production || {};
  const manifest = {
    schema: 'pmia-handoff-draft/v1', version: production.diagnostics?.fingerprint?.version || '0.9.0',
    sessionId: snapshot.sessionId || '', route: production.routeReadiness?.route || '',
    operatingProfile: snapshot.productionControls?.operatingProfile || 'balanced',
    release: production.releaseHandoff || null, diagnostics: production.diagnostics || null,
    generatedAt: Date.now()
  };
  const blob = new Blob([`${JSON.stringify(manifest, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `pmia-handoff-draft-${sessionId.replace(/[^A-Za-z0-9_-]+/g, '_')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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

document.querySelectorAll('[data-accessibility-name],#reducedMotionPreference,#textScalePreference,#contrastPreference').forEach(node => {
  node.addEventListener('change', event => {
    const idMap = { reducedMotionPreference: 'reducedMotion', textScalePreference: 'textScale', contrastPreference: 'contrast' };
    const name = event.currentTarget.dataset.accessibilityName || idMap[event.currentTarget.id];
    void runCommand(event.currentTarget, 'set_accessibility_preference', { name, value: event.currentTarget.value }).then(result => {
      if (!result?.ok) return;
      state.snapshot = { ...state.snapshot, uiPreferences: { ...(state.snapshot?.uiPreferences || {}), accessibility: result.preferences } };
      applyAccessibilityPreferences(document.documentElement, result.preferences);
      text('shortcutPreferenceStatus', `${humanizeCode(name)} set to ${humanizeCode(result.value)}.`);
    });
  });
});

byId('traceSearch').addEventListener('input', event => {
  state.traceQuery = String(event.currentTarget.value || '');
  state.selectedTraceId = '';
  idleWork.schedule(() => renderReview(state.snapshot));
});

byId('assistCommandSearch').addEventListener('input', event => {
  state.assistCommandQuery = String(event.currentTarget.value || '');
  idleWork.schedule(() => renderLiveAssist({ document, snapshot:state.snapshot, state, now:Date.now() }));
});

function currentReceiverPolicy() {
  return state.snapshot?.batchState?.receiverPolicy || {};
}

byId('pauseAfterAnswer').addEventListener('click', event => {
  const policy = currentReceiverPolicy();
  void runCommand(event.currentTarget, 'set_receiver_policy', {
    policy: { pauseAfterAnswer: !Boolean(policy.pauseAfterAnswer) }
  });
});
byId('drainOne').addEventListener('click', event => {
  void runCommand(event.currentTarget, 'set_receiver_policy', { policy: { drainMode: 'one' } });
});
byId('drainAll').addEventListener('click', event => {
  void runCommand(event.currentTarget, 'set_receiver_policy', { policy: { drainMode: 'all' } });
});
byId('stopDrain').addEventListener('click', event => {
  void runCommand(event.currentTarget, 'set_receiver_policy', { policy: { drainMode: 'off' } });
});
byId('submitOnIdle').addEventListener('click', event => {
  const policy = currentReceiverPolicy();
  void runCommand(event.currentTarget, 'set_receiver_policy', {
    policy: { submitOnIdle: !Boolean(policy.submitOnIdle) }
  });
});
byId('acknowledgeAnswer').addEventListener('click', event => {
  void runCommand(event.currentTarget, 'acknowledge_answer');
});
for (const [id, action] of [
  ['resolveNoResponseWait', 'wait'],
  ['resolveNoResponseRetry', 'retry'],
  ['resolveNoResponseContinue', 'continue']
]) {
  byId(id).addEventListener('click', event => {
    void runCommand(event.currentTarget, 'resolve_no_response', { action });
  });
}
byId('previewInterrupt').addEventListener('click', event => {
  void runCommand(event.currentTarget, 'preview_interrupt_latest').then(result => {
    state.interruptPlanDraft = result?.ok ? result : result?.plan || null;
    renderReceiverFlow(state.snapshot);
  });
});
byId('confirmInterrupt').addEventListener('click', event => {
  const plan = state.interruptPlanDraft || state.snapshot?.batchState?.interruptPlan;
  if (!plan?.token) return showToast('Prepare the interrupt again before confirming.', 'warn');
  void runCommand(event.currentTarget, 'interrupt_latest', { token: plan.token }).then(result => {
    if (result?.ok) state.interruptPlanDraft = null;
  });
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
  if (paletteOpen) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      state.commandPalette = movePaletteSelection(state.commandPalette, event.key === 'ArrowDown' ? 1 : -1);
      renderCommandPalette();
      return;
    }
    if (event.key === 'Enter') { event.preventDefault(); void executePaletteSelection(); return; }
  }
  if (dialogFocus.handleKey(event)) {
    if (event.key === 'Escape' && paletteOpen) { state.commandPalette = { ...state.commandPalette, open: false }; renderCommandPalette(); }
    return;
  }
  if (event.repeat) return;
  const shortcutCommand = resolveShortcutCommand(state.snapshot?.uiPreferences?.shortcutBindings || shortcutBindings, event);
  if (!shortcutCommand) return;
  if (event.target.matches('input,select,textarea') && !['command_palette','shortcut_help'].includes(shortcutCommand)) return;
  event.preventDefault();
  if (shortcutCommand === 'shortcut_help') { renderAccessibility(state.snapshot); dialogFocus.open(byId('shortcutHelpDialog'), document.activeElement); return; }
  if (shortcutCommand === 'command_palette') { paletteOpen ? closeCommandPalette() : openCommandPalette(document.activeElement); return; }
  if (shortcutCommand === 'toggle_pause') { void runKeyboardCommand(state.snapshot?.mode === 'paused' ? 'resume_without_send' : 'pause'); return; }
  if (shortcutCommand === 'copy_latest') { byId('copyLatest').click(); return; }
  if (shortcutCommand === 'copy_health_report') { byId('copyHealthReport').click(); return; }
  if (shortcutCommand === 'copy_diagnostics') { byId('copyDiagnostics').click(); return; }
  void runKeyboardCommand(shortcutCommand);
});

setInterval(() => {
  if (state.snapshot) render();
}, 1000);

connect();
render();
