import {
  buildDiagnostics,
  commandResultLabel,
  deriveReview,
  formatDuration,
  latestReceiverProof,
  primaryTransportAction,
  roleHealth,
  virtualSlice,
  warningLabel
} from './dashboard-model.js';
import { catchUpLabel, deriveLatencyRail, deriveLiveInbox } from './live-inbox-model.js';
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

const params = new URLSearchParams(location.search);
const sessionId = String(params.get('session') || '').trim();
const state = {
  snapshot: null,
  port: null,
  reconnectAttempt: 0,
  reconnectTimer: null,
  selectedQueueId: '',
  queueFilter: 'actionable',
  timelineFilter: 'all',
  activeView: 'overview',
  sessionEnded: false,
  pending: new Map(),
  efficiency: { full: 0, delta: 0, heartbeat: 0, lastMode: 'Waiting', changedSections: 0 }
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
  const delay = Math.min(8000, 350 * (2 ** Math.min(5, state.reconnectAttempt)));
  clearTimeout(state.reconnectTimer);
  state.reconnectTimer = setTimeout(connect, delay);
}

function handlePortMessage(message) {
  if (message?.type === 'PMIA_DASHBOARD_SNAPSHOT') {
    state.reconnectAttempt = 0;
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
      : `${readiness.blockers.length} blocker(s) must be resolved before relying on the runtime.`);
  const list = byId('readinessBlockers');
  list.replaceChildren();
  for (const value of readiness.blockers.slice(0, 5)) {
    const item = document.createElement('li');
    item.textContent = value.label;
    list.append(item);
  }
}

function renderLiveCommandCenter(snapshot, now) {
  if (!snapshot) {
    const stateCard = document.querySelector('.live-state-card');
    if (stateCard) stateCard.dataset.catchUp = 'answering';
    text('catchUpState', state.sessionEnded ? 'Session ended' : 'Connecting');
    text('catchUpDetail', state.sessionEnded
      ? 'The lossless session state was cleared after managed shutdown.'
      : 'Waiting for the first authoritative ledger snapshot.');
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
    text('oldestInboxAge', '--');
    renderLatencyRail(null);
    return;
  }
  const inbox = deriveLiveInbox(snapshot, now);
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
  text('currentAnswerBadge', snapshot?.receiver?.generating ? 'Generating' : active ? 'Awaiting completion' : 'Idle');
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
    ? `${outbox.lastError || 'Waiting for service-worker acknowledgement'}${outbox.retryInMs ? ` - retry in ${formatDuration(outbox.retryInMs)}` : ''}.`
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

function renderRole(roleName, role, now) {
  const health = roleHealth(role, now);
  const prefix = roleName;
  const healthNode = byId(`${prefix}Health`);
  healthNode.textContent = health.label;
  healthNode.dataset.tone = health.tone;
  text(`${prefix}Provider`, role?.provider || '--');
  text(`${prefix}Phase`, role?.phase || '--');
  text(`${prefix}Composer`, role?.composerReady ? 'Ready' : 'Waiting');
  text(`${prefix}Heartbeat`, health.ageMs === null ? '--' : `${formatDuration(health.ageMs)} ago`);
  const capabilities = role?.adapterCapabilities;
  text(`${prefix}Adapter`, !capabilities
    ? 'Unknown'
    : capabilities.complete
      ? 'Complete'
      : `Missing: ${(capabilities.missingRequired || []).join(', ')}`);
  if (roleName === 'sender') {
    text('senderVoice', role?.voiceActive ? 'Active' : 'Idle');
    text('senderSilence', role?.sourceSilenceMs ? formatDuration(role.sourceSilenceMs) : '0s');
  } else {
    text('receiverGenerating', role?.generating ? 'Generating' : 'Idle');
    text('receiverScroll', role?.scrollLocked ? 'Locked' : 'Free');
  }
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
  renderRole('sender', snapshot?.sender, now);
  renderRole('receiver', snapshot?.receiver, now);
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

function renderQueue(snapshot, now) {
  const body = byId('queueBody');
  body.replaceChildren();
  const ledger = Array.isArray(snapshot?.ledger) ? snapshot.ledger : [];
  const inbox = state.queueFilter === 'all'
    ? ledger
    : ledger.filter(item => ['persisted', 'failed', 'staged', 'submitting'].includes(item?.state));
  if (!inbox.length) {
    state.selectedQueueId = '';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'empty';
    cell.textContent = state.queueFilter === 'all' ? 'No ledger entries.' : 'Inbox is caught up.';
    row.append(cell);
    body.append(row);
    return;
  }
  if (!inbox.some(item => item.id === state.selectedQueueId)) {
    state.selectedQueueId = inbox.findLast?.(item => ['persisted', 'failed'].includes(item.state))?.id
      || [...inbox].reverse().find(item => ['persisted', 'failed'].includes(item.state))?.id
      || inbox.at(-1)?.id || '';
  }
  for (const item of inbox) {
    const row = document.createElement('tr');
    const ledgerState = item.state || item.ledgerState || item.status || 'persisted';
    if (item.id === state.selectedQueueId) row.classList.add('selected');
    row.classList.add(ledgerState);
    row.addEventListener('click', () => {
      state.selectedQueueId = item.id;
      renderQueue(state.snapshot, Date.now());
    });
    const selectCell = document.createElement('td');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'queueItem';
    radio.checked = item.id === state.selectedQueueId;
    radio.disabled = !['persisted', 'failed'].includes(ledgerState);
    radio.setAttribute('aria-label', `Select inbox item ${item.envelope?.seq || ''}`);
    selectCell.append(radio);
    const age = document.createElement('td');
    age.textContent = formatDuration(now - Number(item.persistedAt || item.queuedAt || now));
    const seq = document.createElement('td');
    seq.textContent = String(item.envelope?.seq || 0);
    const status = document.createElement('td');
    status.textContent = ledgerState;
    const batch = document.createElement('td');
    batch.className = 'batch';
    batch.textContent = item.batchId || '--';
    const question = document.createElement('td');
    question.className = 'question';
    question.textContent = item.envelope?.text || '';
    row.append(selectCell, age, seq, status, batch, question);
    body.append(row);
  }
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
  byId('repairReport').textContent = snapshot?.lastRepair
    ? JSON.stringify(snapshot.lastRepair, null, 2)
    : 'No repair has been run.';
}

function updateControlAvailability() {
  const unavailable = !state.snapshot || state.sessionEnded;
  document.querySelectorAll('[data-command], #submitSelected, #archiveSelected, #archiveProven, #archiveAll, #copyLatest').forEach(node => {
    const busy = node.dataset.busy === 'true';
    const commandBlocked = state.pending.size > 0 && Boolean(node.dataset.command);
    node.disabled = unavailable || busy || commandBlocked;
  });
  if (!unavailable) {
    const batch = state.snapshot?.batchState || {};
    const nextCount = Number(batch.next?.questionCount || batch.next?.memberIds?.length || 0);
    const active = Boolean(batch.active);
    const generating = Boolean(state.snapshot?.receiver?.generating);
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
  if (changed('ledger', 'ledgerCounts', 'batchState', 'mode')) renderQueue(state.snapshot, now);
  if (changed('timeline')) renderTimeline(state.snapshot);
  if (changed('metrics', 'lastRepair', 'timeline', 'sender', 'receiver')) renderReview(state.snapshot);
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
  const button = event.target.closest('[data-command]');
  if (button) {
    const command = button.dataset.command;
    const payload = command === 'set_auto_submit'
      ? { value: state.snapshot?.batchState?.autoSubmit === false }
      : command === 'set_hold'
        ? { value: !Boolean(state.snapshot?.batchState?.hold) }
        : {};
    void runCommand(button, command, payload);
  }
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
byId('queueFilter').addEventListener('change', event => {
  state.queueFilter = event.target.value;
  renderQueue(state.snapshot, Date.now());
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
