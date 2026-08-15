import { DeliveryLedger } from './delivery-ledger.js';
import { CommandResultJournal } from './command-result-journal.js';
import { RecoveryBudget } from './recovery-budget.js';
import { createTraceSpan } from './delivery-trace.js';
import { deriveBacklogForecast } from './backlog-forecast.js';
import { RuntimePerformanceBudget } from './runtime-performance-budget.js';
import { normalizeLiveSession, transitionLiveSession as transitionLiveSessionValue, markInterviewerActivity, setFocusMode } from './live-session-state.js';
import { normalizeQuestionMetadataIndex, updateQuestionMetadata } from './question-metadata-index.js';
import { consumeUndo, normalizeUndoJournal, recordUndo } from './operator-undo-journal.js';
import { updateIncidentControl } from './incident-center.js';
import { addOperatorMarker, removeOperatorMarker } from './operator-markers.js';
import { normalizeSessionCheckpoint } from './session-checkpoint.js';
import { normalizeLayoutHistory, popLayoutHistory, pushLayoutHistory } from './layout-history.js';
import { defaultShortcutBindings, normalizeShortcutBindings, setShortcutBinding } from './shortcut-bindings.js';
import { normalizeSessionNavigator, touchSessionNavigator, recordNavigatorHistory, upsertNavigatorBookmark, removeNavigatorBookmark, upsertNavigatorGoal, tagNavigatorCoverage, upsertNavigatorWorkspace, markNavigatorScenarioComplete, recordNavigatorDebriefExport } from './session-navigator-state.js';
import { auditSessionNavigator, repairSessionNavigator } from './session-navigator-integrity.js';
import { normalizeTurnCoordination } from './turn-coordination-state.js';
import { createTurnCoordinationPerformance, recordTurnCoordinationSample as recordCoordinationSample, deriveTurnCoordinationPerformance } from './turn-coordination-performance.js';

const MODES = new Set(['active', 'paused', 'repairing', 'degraded', 'blocked', 'ended']);
const ROLE_NAMES = ['sender', 'receiver'];
const ALL_ROLE_NAMES = ['sender', 'receiver', 'comparison'];
const COORDINATION_EVENT_TYPES = new Set([
  'forwarding_paused',
  'forwarding_resumed',
  'forwarding_resumed_without_send',
  'source_interruption_detected',
  'source_interruption_resolved'
]);
const MAX_TIMELINE = 200;
const MAX_COMMAND_RESULTS = 128;
const MAX_METRIC_SAMPLES = 40;

function emptyRole() {
  return {
    connected: false,
    tabId: null,
    windowId: null,
    provider: '',
    phase: 'missing',
    composerReady: false,
    generating: false,
    voiceActive: false,
    micState: 'unknown',
    scrollLocked: false,
    localPaused: false,
    heartbeatAt: 0,
    lastActivityAt: 0,
    pageUrl: '',
    transportLane: { state: 'unknown', lastMode: '', lastRttMs: 0, consecutiveFailures: 0, nextProbeAt: 0, lastFailureReason: '', score: 0, scoreState: 'unknown', preferredMode: 'fallback', protocolVersion: 0, epoch: 0, capabilities: [], handshakeReady: false, updatedAt: 0 },
    instanceId: '',
    lastRegistrationAt: 0,
    registrationHeartbeatCount: 0
  };
}

function emptyMetrics() {
  return {
    finalsObserved: 0,
    persisted: 0,
    delivered: 0,
    failed: 0,
    duplicateAcks: 0,
    archived: 0,
    answerTimeouts: 0,
    answersCompleted: 0,
    answersNoResponse: 0,
    answersTimedOut: 0,
    answersCancelled: 0,
    answerTerminalBatches: [],
    deliveryProofMs: [],
    answerElapsedMs: [],
    answerWordCounts: [],
    turnCoordination: createTurnCoordinationPerformance()
  };
}

function normalizeMetrics(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...emptyMetrics(),
    finalsObserved: Number(source.finalsObserved || 0),
    persisted: Number(source.persisted || source.queued || 0),
    delivered: Number(source.delivered || 0),
    failed: Number(source.failed || 0),
    duplicateAcks: Number(source.duplicateAcks || 0),
    archived: Number(source.archived || source.superseded || 0),
    answerTimeouts: Number(source.answerTimeouts || 0),
    answersCompleted: Number(source.answersCompleted || 0),
    answersNoResponse: Number(source.answersNoResponse || 0),
    answersTimedOut: Number(source.answersTimedOut || source.answerTimeouts || 0),
    answersCancelled: Number(source.answersCancelled || 0),
    answerTerminalBatches: Array.isArray(source.answerTerminalBatches) ? source.answerTerminalBatches.map(String).slice(-128) : [],
    deliveryProofMs: Array.isArray(source.deliveryProofMs) ? source.deliveryProofMs.slice(-MAX_METRIC_SAMPLES) : [],
    answerElapsedMs: Array.isArray(source.answerElapsedMs) ? source.answerElapsedMs.slice(-MAX_METRIC_SAMPLES) : [],
    answerWordCounts: Array.isArray(source.answerWordCounts)
      ? source.answerWordCounts.map(Number).filter(value => Number.isFinite(value) && value > 0).slice(-MAX_METRIC_SAMPLES)
      : [],
    turnCoordination: createTurnCoordinationPerformance(source.turnCoordination || {})
  };
}

function isDefaultTurnCoordination(value = {}) {
  const state = normalizeTurnCoordination(value, 0);
  return state.policy === 'adaptive'
    && state.mode === 'live'
    && state.pausedAt === 0
    && state.resumedAt === 0
    && !state.releaseIntent
    && ['none', ''].includes(String(state.interruption?.state || 'none'))
    && !state.interruption?.chainId
    && !(state.interruption?.memberIds || []).length;
}

function mergeTurnCoordination(current = {}, incoming = {}, now = Date.now(), fallbackUpdatedAt = 0) {
  const currentState = normalizeTurnCoordination(current, now);
  const incomingUpdatedAt = Math.max(0, Number(incoming?.updatedAt || fallbackUpdatedAt || 0));
  if (!incomingUpdatedAt) return currentState;
  const candidate = normalizeTurnCoordination({ ...incoming, updatedAt: incomingUpdatedAt }, incomingUpdatedAt);
  if (isDefaultTurnCoordination(currentState) && !isDefaultTurnCoordination(candidate)) return candidate;
  return candidate.updatedAt > currentState.updatedAt ? candidate : currentState;
}

function normalizeOutboxState(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    count: Math.max(0, Number(source.count || 0)),
    replaying: Boolean(source.replaying),
    attempts: Math.max(0, Number(source.attempts || 0)),
    nextRetryAt: Math.max(0, Number(source.nextRetryAt || 0)),
    oldestCreatedAt: Math.max(0, Number(source.oldestCreatedAt || 0)),
    lastError: String(source.lastError || ''),
    persistenceError: String(source.persistenceError || ''),
    restoredCount: Math.max(0, Number(source.restoredCount || 0)),
    recoverySource: String(source.recoverySource || ''),
    retryIntent: source.retryIntent && typeof source.retryIntent === 'object' ? {
      envelopeId: String(source.retryIntent.envelopeId || ''),
      dueAt: Math.max(0, Number(source.retryIntent.dueAt || 0)),
      attempt: Math.max(0, Number(source.retryIntent.attempt || 0)),
      reason: String(source.retryIntent.reason || ''),
      source: String(source.retryIntent.source || '')
    } : null,
    updatedAt: Math.max(0, Number(source.updatedAt || 0))
  };
}

function average(values) {
  const list = (Array.isArray(values) ? values : []).filter(Number.isFinite);
  if (!list.length) return 0;
  return Math.round(list.reduce((sum, value) => sum + value, 0) / list.length);
}

function cloneRole(value) {
  return { ...emptyRole(), ...(value && typeof value === 'object' ? value : {}) };
}

function safeEventData(data = {}) {
  const safe = data && typeof data === 'object' ? { ...data } : {};
  if (safe.kind === 'boot' || safe.type === 'boot') safe.text = '[Session setup redacted]';
  if (typeof safe.text === 'string' && safe.text.length > 1200) {
    safe.text = `${safe.text.slice(0, 1200)}…`;
  }
  return safe;
}

function normalizeIncidentControls(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const controls = {};
  for (const [id, item] of Object.entries(source.controls && typeof source.controls === 'object' ? source.controls : source)) {
    const key = String(id || '').trim().slice(0, 200);
    if (!key || key === 'quietMode' || !item || typeof item !== 'object') continue;
    controls[key] = {
      acknowledgedAt: Math.max(0, Number(item.acknowledgedAt || 0)),
      snoozedUntil: Math.max(0, Number(item.snoozedUntil || 0))
    };
  }
  const bounded = Object.fromEntries(Object.entries(controls)
    .sort(([, a], [, b]) => Math.max(b.acknowledgedAt, b.snoozedUntil) - Math.max(a.acknowledgedAt, a.snoozedUntil))
    .slice(0, 128));
  return { controls: bounded, quietMode: Boolean(source.quietMode) };
}

function normalizeAccessibilityPreferences(value = {}) {
  return {
    reducedMotion: ['system','on','off'].includes(String(value.reducedMotion)) ? String(value.reducedMotion) : 'system',
    textScale: ['normal','large'].includes(String(value.textScale)) ? String(value.textScale) : 'normal',
    contrast: ['normal','high'].includes(String(value.contrast)) ? String(value.contrast) : 'normal'
  };
}


function normalizeProductionControls(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    operatingProfile: ['safe','balanced','fast'].includes(String(source.operatingProfile)) ? String(source.operatingProfile) : 'balanced',
    containmentOverrideUntil: Math.max(0, Number(source.containmentOverrideUntil || 0)),
    containmentOverrideReason: String(source.containmentOverrideReason || '').slice(0, 120),
    lastProfileChangeAt: Math.max(0, Number(source.lastProfileChangeAt || 0)),
    lastProfileChangeSource: String(source.lastProfileChangeSource || '').slice(0, 80),
    lastNavigation: source.lastNavigation && typeof source.lastNavigation === 'object' ? {
      view: String(source.lastNavigation.view || 'overview').slice(0, 40),
      anchor: String(source.lastNavigation.anchor || '').slice(0, 100),
      reason: String(source.lastNavigation.reason || '').slice(0, 120),
      at: Math.max(0, Number(source.lastNavigation.at || 0))
    } : null
  };
}

function normalizeSession(item) {
  const sessionId = String(item?.sessionId || '').trim();
  if (!sessionId) return null;
  const createdAt = Number.isFinite(item.createdAt) ? item.createdAt : Date.now();
  return {
    sessionId,
    createdAt,
    updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : createdAt,
    mode: MODES.has(item.mode) ? item.mode : 'active',
    sender: cloneRole(item.sender),
    receiver: cloneRole(item.receiver),
    comparison: cloneRole(item.comparison),
    latestPreview: item.latestPreview || null,
    latestFinal: item.latestFinal || null,
    latestProof: item.latestProof || null,
    batchState: {
      updatedAt: Math.max(0, Number(item.batchState?.updatedAt || 0)),
      active: item.batchState?.active || null,
      next: item.batchState?.next || null,
      hold: Boolean(item.batchState?.hold),
      autoSubmit: item.batchState?.autoSubmit !== false,
      lastEvent: item.batchState?.lastEvent || null,
      lastCompleted: item.batchState?.lastCompleted || null,
      draftConflict: item.batchState?.draftConflict || null,
      transaction: item.batchState?.transaction || null,
      lastTransaction: item.batchState?.lastTransaction || null,
      budget: item.batchState?.budget || null,
      scheduling: item.batchState?.scheduling || null,
      receiverPolicy: item.batchState?.receiverPolicy || null,
      preview: item.batchState?.preview || null,
      answerAcknowledgement: item.batchState?.answerAcknowledgement || null,
      pendingNoResponse: item.batchState?.pendingNoResponse || null,
      interruptPlan: item.batchState?.interruptPlan || null,
      answerHandoff: item.batchState?.answerHandoff || null,
      turnCoordination: normalizeTurnCoordination(item.batchState?.turnCoordination || {}, createdAt)
    },
    ledger: new DeliveryLedger(item.ledger || item.queue || []),
    timeline: Array.isArray(item.timeline) ? item.timeline.slice(-MAX_TIMELINE) : [],
    metrics: normalizeMetrics(item.metrics),
    commandJournal: new CommandResultJournal(
      Array.isArray(item.commandJournal)
        ? item.commandJournal
        : (Array.isArray(item.processedCommandIds)
          ? item.processedCommandIds.slice(-MAX_COMMAND_RESULTS).map(requestId => ({
              requestId, command: 'legacy_command', result: { ok: true, duplicate: true, reason: 'legacy_processed' }
            }))
          : []),
      { maxEntries: MAX_COMMAND_RESULTS }
    ),
    dashboardConnections: 0,
    layout: {
      mode: String(item.layout?.mode || 'three_window'),
      hidden: Boolean(item.layout?.hidden),
      focusedRole: ['sender','receiver','pilot'].includes(String(item.layout?.focusedRole || '')) ? String(item.layout.focusedRole) : '',
      history: normalizeLayoutHistory(item.layout?.history || [])
    },
    lastRepair: item.lastRepair || null,
    endedAt: Number.isFinite(item.endedAt) ? item.endedAt : 0,
    storagePressure: item.storagePressure || { bytes: 0, quotaBytes: 10485760, percent: 0, level: 'normal' },
    proofArchive: item.proofArchive || { count: 0, lastProvenAt: 0 },
    contextArmed: Boolean(item.contextArmed),
    contextArmedAt: Number(item.contextArmedAt || 0),
    deliverySla: item.deliverySla && typeof item.deliverySla === 'object' ? { ...item.deliverySla } : { state: 'clear', action: '', nextAction: '', oldestAgeMs: 0, targetMs: 20000, evaluatedAt: 0, lastAction: '', lastActionAt: 0, lastResult: null },
    deliveryPolicy: item.deliveryPolicy && typeof item.deliveryPolicy === 'object' ? { ...item.deliveryPolicy } : { active: false, reason: '', resumeWhen: 'already_active', allowPersist: true, allowProviderWrite: true },
    consistencyAudit: item.consistencyAudit && typeof item.consistencyAudit === 'object' ? JSON.parse(JSON.stringify(item.consistencyAudit)) : null,
    recoverySchedules: Array.isArray(item.recoverySchedules) ? item.recoverySchedules.filter(value => value?.alarmName && value?.dueAt).map(value => ({ ...value })) : [],
    endGuard: item.endGuard && typeof item.endGuard === 'object' ? { ...item.endGuard, counts: { ...(item.endGuard.counts || {}) } } : null,
    senderOutboxState: normalizeOutboxState(item.senderOutboxState),
    selfTest: item.selfTest && typeof item.selfTest === 'object' ? JSON.parse(JSON.stringify(item.selfTest)) : null,
    answerState: item.answerState && typeof item.answerState === 'object' ? { ...item.answerState } : null,
    recoveryBudget: new RecoveryBudget(item.recoveryBudget || {}),
    performanceBudget: new RuntimePerformanceBudget(item.performanceBudget || {}),
    lastTransportDrill: item.lastTransportDrill && typeof item.lastTransportDrill === 'object' ? JSON.parse(JSON.stringify(item.lastTransportDrill)) : null,
    liveSession: normalizeLiveSession(item.liveSession, createdAt),
    questionOperations: {
      metadata: normalizeQuestionMetadataIndex(item.questionOperations?.metadata || {}),
      undoJournal: normalizeUndoJournal(item.questionOperations?.undoJournal || [])
    },
    incidentControls: normalizeIncidentControls(item.incidentControls || {}),
    operatorMarkers: Array.isArray(item.operatorMarkers) ? item.operatorMarkers.map(value => ({ ...value })).slice(-100) : [],
    checkpoint: item.checkpoint && typeof item.checkpoint === 'object' ? normalizeSessionCheckpoint(item.checkpoint) : null,
    sloHistory: Array.isArray(item.sloHistory) ? item.sloHistory.slice(-120).map(value => ({ ...value })) : [],
    stabilizationRunbook: item.stabilizationRunbook && typeof item.stabilizationRunbook === 'object' ? JSON.parse(JSON.stringify(item.stabilizationRunbook)) : null,
    crashResumeDismissedAt: Math.max(0, Number(item.crashResumeDismissedAt || 0)),
    uiPreferences: {
      shortcutBindings: normalizeShortcutBindings(item.uiPreferences?.shortcutBindings || {}),
      accessibility: normalizeAccessibilityPreferences(item.uiPreferences?.accessibility || {})
    },
    productionControls: normalizeProductionControls(item.productionControls || {}),
    sessionNavigator: normalizeSessionNavigator(item.sessionNavigator || {})
  };
}

export class RuntimePilotState {
  #sessions = new Map();

  constructor(state = []) {
    for (const item of Array.isArray(state) ? state : []) {
      const session = normalizeSession(item);
      if (session) this.#sessions.set(session.sessionId, session);
    }
  }

  ensure(sessionId, now = Date.now()) {
    const normalized = String(sessionId || '').trim();
    if (!normalized) throw new TypeError('Invalid PMIA session');
    if (!this.#sessions.has(normalized)) {
      const session = normalizeSession({ sessionId: normalized, createdAt: now });
      this.#sessions.set(normalized, session);
    }
    return this.#sessions.get(normalized);
  }

  remove(sessionId) {
    return this.#sessions.delete(String(sessionId || '').trim());
  }

  setMode(sessionId, mode, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.mode = MODES.has(mode) ? mode : session.mode;
    session.updatedAt = now;
    this.record(sessionId, 'transport_mode', { mode: session.mode }, now);
    return session.mode;
  }

  setLiveSession(sessionId, value = {}, now = Date.now(), { record = true } = {}) {
    const session = this.ensure(sessionId, now);
    const previous = session.liveSession;
    session.liveSession = normalizeLiveSession({ ...previous, ...(value && typeof value === 'object' ? value : {}) }, session.createdAt);
    session.updatedAt = now;
    if (record && previous.phase !== session.liveSession.phase) this.record(sessionId, 'live_session_phase', {
      phase: session.liveSession.phase,
      source: session.liveSession.history.at(-1)?.source || 'operator'
    }, now);
    return JSON.parse(JSON.stringify(session.liveSession));
  }

  transitionLiveSession(sessionId, phase, now = Date.now(), source = 'operator') {
    const session = this.ensure(sessionId, now);
    return this.setLiveSession(sessionId, transitionLiveSessionValue(session.liveSession, phase, now, source), now);
  }

  markInterviewerActivity(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.liveSession = markInterviewerActivity(session.liveSession, now);
    session.updatedAt = now;
    this.record(sessionId, 'interviewer_activity_marked', {}, now);
    return JSON.parse(JSON.stringify(session.liveSession));
  }

  setFocusMode(sessionId, enabled, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.liveSession = setFocusMode(session.liveSession, enabled);
    session.updatedAt = now;
    this.record(sessionId, 'focus_mode_changed', { enabled: Boolean(enabled) }, now);
    return JSON.parse(JSON.stringify(session.liveSession));
  }


  setSessionNavigator(sessionId, value = {}, now = Date.now(), { record = true } = {}) {
    const session = this.ensure(sessionId, now);
    session.sessionNavigator = normalizeSessionNavigator({ ...session.sessionNavigator, ...(value && typeof value === 'object' ? value : {}) });
    session.updatedAt = now;
    if (record) this.record(sessionId, 'session_navigator_updated', { defaultTab: session.sessionNavigator.defaultTab }, now);
    return JSON.parse(JSON.stringify(session.sessionNavigator));
  }

  touchSessionNavigator(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.sessionNavigator = touchSessionNavigator(session.sessionNavigator, now);
    session.updatedAt = now;
    return JSON.parse(JSON.stringify(session.sessionNavigator));
  }

  recordSessionNavigatorVisit(sessionId, entry = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.sessionNavigator = recordNavigatorHistory(session.sessionNavigator, entry, now);
    session.updatedAt = now;
    return JSON.parse(JSON.stringify(session.sessionNavigator));
  }

  upsertSessionNavigatorBookmark(sessionId, bookmark = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now); const result = upsertNavigatorBookmark(session.sessionNavigator, bookmark, now);
    session.sessionNavigator = result.value; session.updatedAt = now; this.record(sessionId, 'navigator_bookmark_saved', { bookmarkId: result.id, targetType: bookmark.targetType || '' }, now); return result;
  }

  removeSessionNavigatorBookmark(sessionId, bookmarkId, now = Date.now()) {
    const session = this.ensure(sessionId, now); const result = removeNavigatorBookmark(session.sessionNavigator, bookmarkId);
    session.sessionNavigator = result.value; session.updatedAt = now; this.record(sessionId, 'navigator_bookmark_removed', { bookmarkId: String(bookmarkId || '') }, now); return result;
  }

  upsertSessionNavigatorGoal(sessionId, goal = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now); const result = upsertNavigatorGoal(session.sessionNavigator, goal, now);
    session.sessionNavigator = result.value; session.updatedAt = now; this.record(sessionId, 'navigator_goal_saved', { goalId: result.id }, now); return result;
  }

  tagSessionNavigatorCoverage(sessionId, questionId, goalIds = [], now = Date.now()) {
    const session = this.ensure(sessionId, now); const result = tagNavigatorCoverage(session.sessionNavigator, questionId, goalIds);
    session.sessionNavigator = result.value; session.updatedAt = now; this.record(sessionId, 'navigator_coverage_tagged', { questionId: String(questionId || ''), goalCount: goalIds.length }, now); return result;
  }

  upsertSessionNavigatorWorkspace(sessionId, workspace = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now); const result = upsertNavigatorWorkspace(session.sessionNavigator, workspace, now);
    session.sessionNavigator = result.value; session.updatedAt = now; this.record(sessionId, 'navigator_workspace_saved', { workspaceId: result.id }, now); return result;
  }

  markSessionNavigatorScenarioComplete(sessionId, scenarioId, now = Date.now()) {
    const session = this.ensure(sessionId, now); const result = markNavigatorScenarioComplete(session.sessionNavigator, scenarioId);
    session.sessionNavigator = result.value; session.updatedAt = now; this.record(sessionId, 'navigator_scenario_completed', { scenarioId: String(scenarioId || '') }, now); return result;
  }

  recordSessionNavigatorDebriefExport(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now); session.sessionNavigator = recordNavigatorDebriefExport(session.sessionNavigator); session.updatedAt = now;
    this.record(sessionId, 'navigator_debrief_exported', { count: session.sessionNavigator.debriefExports }, now); return JSON.parse(JSON.stringify(session.sessionNavigator));
  }

  repairSessionNavigatorMetadata(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const before = this.snapshot(sessionId, now);
    const audit = auditSessionNavigator(before, now);
    if (audit.ok) return { ok: true, changed: false, audit, navigator: JSON.parse(JSON.stringify(session.sessionNavigator)) };
    session.sessionNavigator = normalizeSessionNavigator(repairSessionNavigator(before, now));
    session.updatedAt = now;
    this.record(sessionId, 'navigator_metadata_repaired', { issueCount: audit.count }, now);
    return { ok: true, changed: true, audit, navigator: JSON.parse(JSON.stringify(session.sessionNavigator)) };
  }

  setOperatingProfile(sessionId, profile, now = Date.now(), source = 'operator') {
    const session = this.ensure(sessionId, now);
    const value = ['safe','balanced','fast'].includes(String(profile)) ? String(profile) : 'balanced';
    session.productionControls = normalizeProductionControls({
      ...session.productionControls,
      operatingProfile: value,
      lastProfileChangeAt: now,
      lastProfileChangeSource: String(source || 'operator')
    });
    session.updatedAt = now;
    this.record(sessionId, 'operating_profile_changed', { profile: value, source: String(source || 'operator') }, now);
    return { ...session.productionControls };
  }

  setContainmentOverride(sessionId, enabled, durationMs = 0, reason = 'operator', now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const until = enabled ? now + Math.max(30_000, Math.min(15 * 60_000, Number(durationMs) || 120_000)) : 0;
    session.productionControls = normalizeProductionControls({
      ...session.productionControls,
      containmentOverrideUntil: until,
      containmentOverrideReason: enabled ? String(reason || 'operator') : ''
    });
    session.updatedAt = now;
    this.record(sessionId, enabled ? 'containment_override_started' : 'containment_override_cleared', { until, reason: String(reason || 'operator') }, now);
    return { ...session.productionControls };
  }

  setProductionNavigation(sessionId, route = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.productionControls = normalizeProductionControls({ ...session.productionControls, lastNavigation: { ...route, at: now } });
    session.updatedAt = now;
    return { ...session.productionControls };
  }

  updateQuestionMetadata(sessionId, itemId, patch = {}, action = 'metadata_change', now = Date.now()) {
    const session = this.ensure(sessionId, now);
    if (!session.ledger.get(itemId)) return { ok: false, error: 'ledger_item_missing' };
    const parentId = String(patch?.parentId || '');
    if (parentId && parentId === String(itemId)) return { ok: false, error: 'question_parent_self' };
    if (parentId && !session.ledger.get(parentId)) return { ok: false, error: 'question_parent_missing' };
    const change = updateQuestionMetadata(session.questionOperations.metadata, itemId, patch, now);
    if (!change.ok) return change;
    session.questionOperations.metadata = change.index;
    session.questionOperations.undoJournal = recordUndo(session.questionOperations.undoJournal, {
      action, itemId: change.itemId, before: change.before, after: change.after
    }, now);
    session.updatedAt = now;
    this.record(sessionId, 'question_metadata_changed', { itemId: change.itemId, action }, now);
    return { ok: true, itemId: change.itemId, metadata: { ...change.after }, undo: session.questionOperations.undoJournal.at(-1) };
  }

  undoQuestionMetadata(sessionId, undoId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const result = consumeUndo(session.questionOperations.undoJournal, undoId, now);
    if (!result.ok) return result;
    session.questionOperations.undoJournal = result.journal;
    session.questionOperations.metadata = {
      ...session.questionOperations.metadata,
      [result.entry.itemId]: JSON.parse(JSON.stringify(result.entry.before))
    };
    session.updatedAt = now;
    this.record(sessionId, 'question_metadata_undone', { itemId: result.entry.itemId, action: result.entry.action, undoId: result.entry.id }, now);
    return { ok: true, itemId: result.entry.itemId, metadata: { ...result.entry.before }, undoId: result.entry.id };
  }

  updateIncidentControl(sessionId, incidentId, action, durationMs = 0, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const id = String(incidentId || '').trim().slice(0, 200);
    if (!id) return { ok: false, error: 'incident_id_required' };
    if (!['acknowledge', 'snooze', 'clear'].includes(String(action || ''))) {
      return { ok: false, error: 'invalid_incident_control' };
    }
    session.incidentControls.controls = updateIncidentControl(
      session.incidentControls.controls,
      id,
      action,
      now,
      durationMs
    );
    session.incidentControls = normalizeIncidentControls(session.incidentControls);
    session.updatedAt = now;
    this.record(sessionId, 'incident_control_changed', {
      incidentId: id,
      action: String(action),
      durationMs: action === 'snooze' ? Math.max(60_000, Number(durationMs) || 300_000) : 0
    }, now);
    return { ok: true, incidentId: id, action, controls: JSON.parse(JSON.stringify(session.incidentControls.controls)) };
  }

  setQuietMode(sessionId, enabled, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.incidentControls.quietMode = Boolean(enabled);
    session.updatedAt = now;
    this.record(sessionId, 'quiet_attention_changed', { enabled: Boolean(enabled) }, now);
    return { ok: true, enabled: session.incidentControls.quietMode };
  }

  addOperatorMarker(sessionId, value = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const before = session.operatorMarkers.length;
    session.operatorMarkers = addOperatorMarker(session.operatorMarkers, { ...value, createdAt: value.createdAt || now, source: 'operator' });
    session.updatedAt = now;
    const marker = session.operatorMarkers.at(-1) || null;
    if (marker && session.operatorMarkers.length >= before) this.record(sessionId, 'operator_marker_added', {
      markerId: marker.id, category: marker.category, targetType: marker.targetType, targetId: marker.targetId
    }, now);
    return marker ? { ok: true, marker: { ...marker } } : { ok: false, error: 'invalid_marker' };
  }

  removeOperatorMarker(sessionId, markerId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const id = String(markerId || '').trim();
    const before = session.operatorMarkers.length;
    session.operatorMarkers = removeOperatorMarker(session.operatorMarkers, id);
    session.updatedAt = now;
    if (session.operatorMarkers.length !== before) this.record(sessionId, 'operator_marker_removed', { markerId: id }, now);
    return { ok: session.operatorMarkers.length !== before, markerId: id };
  }

  setCheckpoint(sessionId, value = null, now = Date.now(), { record = false } = {}) {
    const session = this.ensure(sessionId, now);
    session.checkpoint = value && typeof value === 'object' ? normalizeSessionCheckpoint(value) : null;
    session.updatedAt = now;
    if (record && session.checkpoint) this.record(sessionId, 'session_checkpoint', {
      checkpointId: session.checkpoint.id,
      phase: session.checkpoint.phase,
      unresolvedCount: session.checkpoint.unresolvedCount,
      reason: session.checkpoint.reason
    }, now);
    return session.checkpoint ? JSON.parse(JSON.stringify(session.checkpoint)) : null;
  }

  setShortcutBinding(sessionId, command, chord, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const result = setShortcutBinding(session.uiPreferences.shortcutBindings, command, chord);
    if (!result.ok) return result;
    session.uiPreferences.shortcutBindings = result.bindings;
    session.updatedAt = now;
    this.record(sessionId, 'shortcut_binding_changed', { command: result.command, chord: result.chord }, now);
    return { ok: true, command: result.command, chord: result.chord, bindings: { ...result.bindings } };
  }

  resetShortcutBindings(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.uiPreferences.shortcutBindings = defaultShortcutBindings();
    session.updatedAt = now;
    this.record(sessionId, 'shortcut_bindings_reset', { count: Object.keys(session.uiPreferences.shortcutBindings).length }, now);
    return { ok: true, bindings: { ...session.uiPreferences.shortcutBindings } };
  }

  setAccessibilityPreference(sessionId, name, value, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    if (!['reducedMotion','textScale','contrast'].includes(String(name || ''))) return { ok: false, error: 'accessibility_preference_unknown' };
    const next = normalizeAccessibilityPreferences({ ...session.uiPreferences.accessibility, [name]: value });
    if (String(next[name]) !== String(value)) return { ok: false, error: 'accessibility_preference_invalid' };
    session.uiPreferences.accessibility = next;
    session.updatedAt = now;
    this.record(sessionId, 'accessibility_preference_changed', { name, value: next[name] }, now);
    return { ok: true, name, value: next[name], preferences: { ...next } };
  }

  replayCommandResult(sessionId, requestId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    return session.commandJournal.replay(requestId, now);
  }

  recordCommandResult(sessionId, requestId, command, result, startedAt = Date.now(), completedAt = Date.now()) {
    const session = this.ensure(sessionId, completedAt);
    const entry = session.commandJournal.record(requestId, command, result, startedAt, completedAt);
    session.updatedAt = completedAt;
    return entry;
  }

  recordTurnCoordinationSample(sessionId, sample = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.metrics.turnCoordination = recordCoordinationSample(session.metrics.turnCoordination, sample);
    session.updatedAt = now;
    return deriveTurnCoordinationPerformance(session.metrics.turnCoordination, now);
  }

  updateRole(sessionId, role, telemetry, now = Date.now()) {
    if (!ALL_ROLE_NAMES.includes(role)) return null;
    const session = this.ensure(sessionId, now);
    session[role] = {
      ...session[role],
      ...(telemetry && typeof telemetry === 'object' ? telemetry : {}),
      connected: true,
      heartbeatAt: Number(telemetry?.heartbeatAt || now)
    };
    session.updatedAt = now;
    return { ...session[role] };
  }

  setAnswerState(sessionId, value = null, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.answerState = value && typeof value === 'object' ? { ...value } : null;
    session.updatedAt = now;
    return session.answerState ? { ...session.answerState } : null;
  }

  setSelfTest(sessionId, value = null, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.selfTest = value ? JSON.parse(JSON.stringify(value)) : null;
    session.updatedAt = now;
    return session.selfTest ? JSON.parse(JSON.stringify(session.selfTest)) : null;
  }

  setSenderOutboxState(sessionId, value = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.senderOutboxState = normalizeOutboxState({ ...value, updatedAt: now });
    session.updatedAt = now;
    return { ...session.senderOutboxState };
  }




  repairLiveCommandMetadata(sessionId, repaired = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    if (repaired.metadata && typeof repaired.metadata === 'object') session.questionOperations.metadata = JSON.parse(JSON.stringify(repaired.metadata));
    if (Array.isArray(repaired.undoJournal)) session.questionOperations.undoJournal = JSON.parse(JSON.stringify(repaired.undoJournal));
    if (Array.isArray(repaired.markers)) session.operatorMarkers = JSON.parse(JSON.stringify(repaired.markers));
    if (repaired.controls && typeof repaired.controls === 'object') session.incidentControls.controls = JSON.parse(JSON.stringify(repaired.controls));
    session.updatedAt = now;
    this.record(sessionId, 'live_command_metadata_repaired', { repairedAt: now }, now);
    return { ok: true, repairedAt: now };
  }

  setSloHistory(sessionId, history = [], now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.sloHistory = Array.isArray(history) ? history.slice(-120).map(value => ({ ...value })) : [];
    session.updatedAt = now;
    return session.sloHistory.map(value => ({ ...value }));
  }

  setStabilizationRunbook(sessionId, value = null, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.stabilizationRunbook = value ? JSON.parse(JSON.stringify(value)) : null;
    session.updatedAt = now;
    this.record(sessionId, 'stabilization_runbook_updated', { state: value?.state || 'cleared', current: Number(value?.current || 0) }, now);
    return session.stabilizationRunbook ? JSON.parse(JSON.stringify(session.stabilizationRunbook)) : null;
  }

  dismissCrashResume(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.crashResumeDismissedAt = now;
    session.updatedAt = now;
    this.record(sessionId, 'crash_resume_dismissed', { at: now }, now);
    return { ok: true, dismissedAt: now };
  }

  setEndGuard(sessionId, value = null, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.endGuard = value ? { ...value, counts: { ...(value.counts || {}) } } : null;
    session.updatedAt = now;
    return session.endGuard ? { ...session.endGuard, counts: { ...session.endGuard.counts } } : null;
  }

  upsertRecoverySchedule(sessionId, schedule = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const alarmName = String(schedule.alarmName || '').trim();
    if (!alarmName) return null;
    session.recoverySchedules = (session.recoverySchedules || []).filter(value => value.alarmName !== alarmName && value.kind !== schedule.kind);
    session.recoverySchedules.push({ ...schedule, alarmName, updatedAt: Number(schedule.updatedAt || now) });
    session.recoverySchedules.sort((a, b) => Number(a.dueAt || 0) - Number(b.dueAt || 0));
    session.updatedAt = now;
    return { ...schedule, alarmName };
  }

  removeRecoverySchedule(sessionId, alarmName, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const before = session.recoverySchedules?.length || 0;
    session.recoverySchedules = (session.recoverySchedules || []).filter(value => value.alarmName !== String(alarmName || ''));
    session.updatedAt = now;
    return before !== session.recoverySchedules.length;
  }

  clearRecoverySchedules(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const removed = [...(session.recoverySchedules || [])];
    session.recoverySchedules = [];
    session.updatedAt = now;
    return removed;
  }

  setDeliveryPolicy(sessionId, value = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const next = {
      ...(session.deliveryPolicy || {}),
      ...(value && typeof value === 'object' ? value : {})
    };
    const changed = JSON.stringify(session.deliveryPolicy || {}) !== JSON.stringify(next);
    if (changed) {
      session.deliveryPolicy = next;
      session.updatedAt = now;
    }
    return { ...session.deliveryPolicy, changed };
  }

  setConsistencyAudit(sessionId, value = null, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const next = value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : null;
    const signature = audit => audit ? JSON.stringify({
      ok: audit.ok === true,
      repairs: (audit.repairs || []).map(item => [String(item.code || ''), String(item.role || ''), String(item.alarmName || '')]),
      blocked: (audit.blocked || []).map(item => [String(item.code || ''), String(item.role || ''), Number(item.count || 0)]),
      reason: String(audit.reason || '')
    }) : '';
    const changed = signature(session.consistencyAudit) !== signature(next);
    if (!changed) return next ? { ...JSON.parse(JSON.stringify(next)), changed: false } : { changed: false };
    session.consistencyAudit = next;
    session.updatedAt = now;
    if (next) this.record(sessionId, 'consistency_audit', {
      ok: next.ok === true,
      repairs: (next.repairs || []).map(item => item.code),
      blocked: (next.blocked || []).map(item => item.code),
      reason: next.reason || ''
    }, now);
    return next ? { ...JSON.parse(JSON.stringify(next)), changed } : { changed };
  }

  auditLedgerIndex(sessionId, { repair = false } = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const result = session.ledger.indexAudit({ repair });
    session.updatedAt = now;
    return JSON.parse(JSON.stringify(result));
  }

  releaseExpiredAttemptLease(sessionId, ledgerItemId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const entry = session.ledger.get(ledgerItemId);
    const lease = entry?.attemptLease;
    if (!lease || Number(lease.expiresAt || 0) > Number(now)) {
      return { released: false, reason: 'attempt_lease_not_expired' };
    }
    const result = session.ledger.releaseAttemptLease(ledgerItemId, {
      owner: lease.owner,
      leaseId: lease.id,
      now
    });
    if (result.released) session.updatedAt = now;
    return result;
  }

  setDeliverySla(sessionId, value = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.deliverySla = {
      ...(session.deliverySla || {}),
      ...(value && typeof value === 'object' ? value : {}),
      evaluatedAt: Number(value?.evaluatedAt || now)
    };
    session.updatedAt = now;
    return { ...session.deliverySla };
  }

  updateTransportLane(sessionId, role, value = {}, now = Date.now()) {
    if (!ALL_ROLE_NAMES.includes(role)) return null;
    const session = this.ensure(sessionId, now);
    session[role] = {
      ...session[role],
      transportLane: {
        ...(session[role].transportLane || {}),
        ...(value && typeof value === 'object' ? value : {}),
        updatedAt: Number(value?.updatedAt || now)
      }
    };
    session.updatedAt = now;
    return { ...session[role].transportLane };
  }

  disconnectRole(sessionId, role, now = Date.now()) {
    if (!ALL_ROLE_NAMES.includes(role)) return null;
    const session = this.ensure(sessionId, now);
    session[role] = { ...session[role], connected: false, phase: 'missing' };
    session.updatedAt = now;
    this.record(sessionId, 'role_disconnected', { role }, now);
    return { ...session[role] };
  }

  setDashboardConnections(sessionId, count, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.dashboardConnections = Math.max(0, Number(count) || 0);
    session.updatedAt = now;
    return session.dashboardConnections;
  }

  recordPreview(sessionId, preview, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.latestPreview = preview ? { ...preview, observedAt: now } : null;
    session.updatedAt = now;
  }

  setContextArmed(sessionId, value = true, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.contextArmed = Boolean(value);
    session.contextArmedAt = session.contextArmed ? now : 0;
    session.updatedAt = now;
    this.record(sessionId, session.contextArmed ? 'context_armed' : 'context_disarmed', {}, now);
    return session.contextArmed;
  }

  recordFinal(sessionId, envelope, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.latestFinal = envelope ? {
      id: envelope.id,
      seq: envelope.seq || 0,
      kind: envelope.kind,
      sourceProvider: envelope.sourceProvider,
      text: envelope.kind === 'boot' ? '[Session setup redacted]' : envelope.text,
      createdAt: envelope.createdAt || now,
      observedAt: now
    } : null;
    session.updatedAt = now;
  }

  recordTraceSpan(sessionId, span, now = Date.now()) {
    if (!span?.traceId || !span?.stage) return null;
    const safe = createTraceSpan({ ...span, at: Number(span.at || now) });
    this.record(sessionId, 'delivery_trace_span', safe, now);
    return safe;
  }

  consumeRecoveryBudget(sessionId, options = {}) {
    const session = this.ensure(sessionId, options.now || Date.now());
    const result = session.recoveryBudget.consume(options);
    session.updatedAt = Number(options.now) || Date.now();
    this.record(sessionId, result.accepted ? 'recovery_budget_consumed' : 'recovery_budget_exhausted', {
      source: String(options.source || 'automatic'),
      state: result.state,
      remaining: result.budget.remaining,
      cooldownUntil: result.budget.cooldownUntil,
      reason: result.reason
    }, session.updatedAt);
    return result;
  }

  resetRecoveryBudget(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const budget = session.recoveryBudget.reset(now);
    session.updatedAt = now;
    this.record(sessionId, 'recovery_budget_reset', { resetCount: budget.resetCount }, now);
    return budget;
  }

  recordPerformance(sessionId, sample = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const result = session.performanceBudget.record({ ...sample, at: Number(sample.at || now) });
    session.updatedAt = now;
    return result;
  }

  setTransportDrill(sessionId, report, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.lastTransportDrill = report && typeof report === 'object' ? JSON.parse(JSON.stringify(report)) : null;
    session.updatedAt = now;
    this.record(sessionId, 'transport_drill_complete', {
      ok: report?.ok === true,
      elapsedMs: Math.max(0, Number(report?.elapsedMs) || 0),
      failedChecks: (report?.checks || []).filter(check => !check.ok).map(check => String(check.name || ''))
    }, now);
    return session.lastTransportDrill;
  }
  persistFinal(sessionId, envelope, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const outcome = session.ledger.persist(envelope, { now });
    if (outcome.accepted && !outcome.duplicate) {
      session.metrics.finalsObserved += envelope?.kind === 'question' ? 1 : 0;
      session.metrics.persisted += envelope?.kind === 'question' ? 1 : 0;
      this.recordFinal(sessionId, envelope, now);
      this.record(sessionId, 'final_persisted', {
        envelopeId: envelope.id,
        seq: envelope.seq || 0,
        ledgerState: outcome.entry?.state || 'persisted',
        traceId: String(envelope?.metadata?.traceId || '')
      }, now);
      this.recordTraceSpan(sessionId, { traceId: envelope?.metadata?.traceId, stage: 'ledger_persisted', state: 'complete', envelopeId: envelope.id, seq: envelope.seq, role: 'background' }, now);
    }
    session.updatedAt = now;
    return outcome;
  }

  markLedgerStaged(sessionId, ids, batchId, now = Date.now(), identity = {}) {
    const session = this.ensure(sessionId, now);
    const changed = session.ledger.markStaged(ids, batchId, now, identity);
    if (changed.length) {
      this.record(sessionId, 'batch_staged', { batchId, memberIds: changed.map(item => item.id), memberTraceIds: changed.map(item => item.envelope?.metadata?.traceId).filter(Boolean) }, now);
      for (const item of changed) this.recordTraceSpan(sessionId, { traceId: item.envelope?.metadata?.traceId, stage: 'batch_staged', state: 'complete', envelopeId: item.id, batchId, seq: item.envelope?.seq, role: 'background' }, now);
    }
    return changed;
  }

  markLedgerSubmitting(sessionId, batchId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const changed = session.ledger.markSubmitting(batchId, now);
    if (changed.length) {
      this.record(sessionId, 'batch_submitting', { batchId, memberIds: changed.map(item => item.id), memberTraceIds: changed.map(item => item.envelope?.metadata?.traceId).filter(Boolean) }, now);
      for (const item of changed) this.recordTraceSpan(sessionId, { traceId: item.envelope?.metadata?.traceId, stage: 'provider_submitting', state: 'active', envelopeId: item.id, batchId, seq: item.envelope?.seq, role: 'receiver' }, now);
    }
    return changed;
  }

  markLedgerProven(sessionId, batchId, proof = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const result = session.ledger.markBatchProven(batchId, proof, now);
    session.metrics.delivered += result.changed.length;
    if (result.changed.length) {
      this.record(sessionId, 'batch_proven', {
        batchId, memberIds: result.changed.map(item => item.id), memberTraceIds: result.changed.map(item => item.envelope?.metadata?.traceId).filter(Boolean), proof
      }, now);
      for (const item of result.changed) this.recordTraceSpan(sessionId, { traceId: item.envelope?.metadata?.traceId, stage: 'rendered_proof', state: 'complete', envelopeId: item.id, batchId, seq: item.envelope?.seq, role: 'receiver' }, now);
    } else if (!result.accepted) {
      this.record(sessionId, 'batch_proof_rejected', {
        batchId, reason: result.reason, memberIds: proof?.memberIds || []
      }, now);
    } else if (result.duplicate) {
      session.metrics.duplicateAcks += 1;
      this.record(sessionId, 'batch_proof_duplicate', { batchId, memberIds: proof?.memberIds || [] }, now);
    }
    return result;
  }

  markLedgerFailed(sessionId, ids, reason = 'delivery_failed', now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const changed = session.ledger.markFailed(ids, reason, now);
    if (changed.length) {
      this.record(sessionId, 'ledger_entries_failed', {
        memberIds: changed.map(entry => entry.id),
        reason
      }, now);
    }
    return changed;
  }

  markLedgerItemSubmitting(sessionId, itemId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const entry = session.ledger.markItemSubmitting(itemId, now);
    if (entry) this.record(sessionId, 'ledger_item_submitting', { ledgerItemId: itemId }, now);
    return entry;
  }

  completeLedgerItem(sessionId, itemId, outcome = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    let entry = null;
    let eventType = 'ledger_item_failed';
    if (outcome.delivered) {
      entry = session.ledger.markItemProven(itemId, outcome.proof || {
        reason: outcome.reason || 'accepted',
        verified: Boolean(outcome.proof?.verified)
      }, now);
      if (entry) session.metrics.delivered += 1;
      eventType = 'ledger_item_proven';
    } else if (outcome.queued || outcome.staged) {
      entry = session.ledger.markPersisted([itemId], outcome.reason || 'receiver_unavailable', now)[0] || null;
      eventType = 'ledger_item_persisted';
    } else {
      entry = session.ledger.markFailed([itemId], outcome.reason || 'delivery_failed', now)[0] || null;
    }
    if (entry) {
      this.record(sessionId, eventType, {
        ledgerItemId: itemId,
        reason: outcome.reason || ''
      }, now);
    }
    return entry;
  }

  archiveLedgerItem(sessionId, itemId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const entry = session.ledger.archiveEntry(itemId, now);
    if (entry) {
      session.metrics.archived += 1;
      this.record(sessionId, 'ledger_item_archived', { ledgerItemId: itemId }, now);
    }
    return entry;
  }

  archiveProven(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const removed = session.ledger.archiveProven(now);
    session.metrics.archived += removed.length;
    if (removed.length) this.record(sessionId, 'proven_entries_archived', { count: removed.length }, now);
    return removed;
  }

  archiveAllUnresolved(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const removed = session.ledger.archiveAllUnresolved(now);
    session.metrics.archived += removed.length;
    if (removed.length) this.record(sessionId, 'unresolved_entries_archived', { count: removed.length }, now);
    return removed;
  }

  recordDelivery(sessionId, outcome = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    if (!outcome.delivered && !outcome.queued && !outcome.staged && !outcome.duplicate && !outcome.buffered) {
      session.metrics.failed += 1;
    }
    if (outcome.duplicate) session.metrics.duplicateAcks += 1;
    const elapsed = Number(outcome.deliveryProofMs);
    if (Number.isFinite(elapsed) && !outcome.duplicate) {
      session.metrics.deliveryProofMs.push(elapsed);
      session.metrics.deliveryProofMs = session.metrics.deliveryProofMs.slice(-MAX_METRIC_SAMPLES);
    }
    this.record(sessionId, 'delivery_outcome', safeEventData(outcome), now);
  }

  recordAnswer(sessionId, event = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const state = String(event.state || (event.timeout ? 'timed_out' : 'complete'));
    const batchId = String(event.batchId || event.envelopeId || '');
    if (batchId && session.metrics.answerTerminalBatches.includes(batchId)) return false;
    if (batchId) session.metrics.answerTerminalBatches = [...session.metrics.answerTerminalBatches, batchId].slice(-128);
    if (state === 'complete') session.metrics.answersCompleted += 1;
    else if (state === 'no_response') session.metrics.answersNoResponse += 1;
    else if (state === 'timed_out') {
      session.metrics.answersTimedOut += 1;
      session.metrics.answerTimeouts += 1;
    } else if (state === 'cancelled') session.metrics.answersCancelled += 1;
    const elapsed = Number(event.elapsedMs);
    if (Number.isFinite(elapsed) && state === 'complete') {
      session.metrics.answerElapsedMs.push(elapsed);
      session.metrics.answerElapsedMs = session.metrics.answerElapsedMs.slice(-MAX_METRIC_SAMPLES);
    }
    const wordCount = Number(event.wordCount);
    if (Number.isFinite(wordCount) && wordCount > 0 && state === 'complete') {
      session.metrics.answerWordCounts.push(wordCount);
      session.metrics.answerWordCounts = session.metrics.answerWordCounts.slice(-MAX_METRIC_SAMPLES);
    }
    this.record(sessionId, `answer_${state}`, safeEventData({ ...event, state }), now);
    for (const item of session.ledger.snapshot().filter(entry => String(entry.batchId || '') === batchId)) {
      this.recordTraceSpan(sessionId, {
        traceId: item.envelope?.metadata?.traceId,
        stage: 'answer_terminal',
        state,
        envelopeId: item.id,
        batchId,
        seq: item.envelope?.seq,
        reason: String(event.reason || state),
        durationMs: Math.max(0, Number(event.elapsedMs) || 0),
        role: 'receiver'
      }, now);
    }
    return true;
  }

  restoreBatchState(sessionId, checkpoint = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const next = checkpoint && typeof checkpoint === 'object' ? checkpoint : {};
    const checkpointUpdatedAt = Math.max(0, Number(next.updatedAt || now));
    const currentUpdatedAt = Math.max(0, Number(session.batchState.updatedAt || 0));
    if (currentUpdatedAt && checkpointUpdatedAt <= currentUpdatedAt) return false;
    const owns = key => Object.prototype.hasOwnProperty.call(next, key);
    const currentActive = session.batchState.active;
    const incomingActive = owns('active') ? (next.active || null) : currentActive;
    const active = owns('active') && incomingActive && currentActive
      && String(incomingActive.batchId || incomingActive.id || '') === String(currentActive.batchId || currentActive.id || '')
      ? { ...currentActive, ...incomingActive, proof: currentActive.proof || incomingActive.proof || null }
      : incomingActive;
    const preserveOrNull = key => owns(key) ? (next[key] || null) : session.batchState[key];
    const normalized = {
      updatedAt: checkpointUpdatedAt,
      active,
      next: preserveOrNull('next'),
      hold: owns('hold') ? Boolean(next.hold) : Boolean(session.batchState.hold),
      autoSubmit: owns('autoSubmit') ? next.autoSubmit !== false : session.batchState.autoSubmit !== false,
      transaction: preserveOrNull('transaction'),
      lastTransaction: preserveOrNull('lastTransaction'),
      budget: preserveOrNull('budget'),
      scheduling: preserveOrNull('scheduling'),
      receiverPolicy: preserveOrNull('receiverPolicy'),
      preview: preserveOrNull('preview'),
      answerAcknowledgement: preserveOrNull('answerAcknowledgement'),
      pendingNoResponse: preserveOrNull('pendingNoResponse'),
      interruptPlan: preserveOrNull('interruptPlan'),
      answerHandoff: preserveOrNull('answerHandoff'),
      turnCoordination: owns('turnCoordination')
        ? mergeTurnCoordination(session.batchState.turnCoordination, next.turnCoordination || {}, now)
        : normalizeTurnCoordination(session.batchState.turnCoordination || {}, now)
    };
    const previous = JSON.stringify({
      updatedAt: session.batchState.updatedAt,
      active: session.batchState.active,
      next: session.batchState.next,
      hold: session.batchState.hold,
      autoSubmit: session.batchState.autoSubmit,
      transaction: session.batchState.transaction,
      lastTransaction: session.batchState.lastTransaction,
      budget: session.batchState.budget,
      scheduling: session.batchState.scheduling,
      receiverPolicy: session.batchState.receiverPolicy,
      preview: session.batchState.preview,
      answerAcknowledgement: session.batchState.answerAcknowledgement,
      pendingNoResponse: session.batchState.pendingNoResponse,
      interruptPlan: session.batchState.interruptPlan,
      answerHandoff: session.batchState.answerHandoff,
      turnCoordination: session.batchState.turnCoordination
    });
    const changed = previous !== JSON.stringify(normalized);
    if (!changed) return false;
    session.batchState = { ...session.batchState, ...normalized };
    session.updatedAt = now;
    return true;
  }

  updateBatchState(sessionId, event = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const type = String(event.type || 'batch_event');
    const memberIds = Array.isArray(event.memberIds) ? event.memberIds.map(String) : [];
    const coordinationSource = event.turnCoordination && typeof event.turnCoordination === 'object'
      ? event.turnCoordination
      : (COORDINATION_EVENT_TYPES.has(type) ? event : null);
    if (coordinationSource) {
      session.batchState.turnCoordination = mergeTurnCoordination(
        session.batchState.turnCoordination,
        coordinationSource,
        now,
        COORDINATION_EVENT_TYPES.has(type) ? now : 0
      );
    }
    if (type === 'batch_submitting' || type === 'batch_submitted') {
      session.batchState.active = {
        batchId: String(event.batchId || ''),
        memberIds,
        questionCount: Number(event.questionCount || memberIds.length),
        submitted: type === 'batch_submitted',
        proof: type === 'batch_submitted' ? (event.proof || null) : null,
        transaction: event.transaction || session.batchState.transaction || null
      };
      if (event.transaction) session.batchState.transaction = event.transaction;
      session.batchState.next = null;
    } else if (type === 'next_batch_draft') {
      session.batchState.next = {
        memberIds,
        questionCount: Number(event.questionCount || memberIds.length),
        protectedCount: Number(event.protectedCount || event.questionCount || memberIds.length),
        partitionCount: Math.max(0, Number(event.partitionCount || 0)),
        firstPartitionCount: Number(event.firstPartitionCount || event.questionCount || memberIds.length),
        remainingCount: Math.max(0, Number(event.remainingCount || 0)),
        written: event.written !== false
      };
    } else if (['batch_answer_complete', 'batch_answer_no_response', 'batch_answer_timeout', 'batch_answer_cancelled'].includes(type)) {
      session.batchState.lastCompleted = {
        ...(session.batchState.active || {}),
        answer: event.answer || null,
        proof: event.proof || session.batchState.active?.proof || null,
        completedAt: now,
        answerState: event.answerState || null,
        timeout: type === 'batch_answer_timeout',
        noResponse: type === 'batch_answer_no_response',
        cancelled: type === 'batch_answer_cancelled'
      };
      session.answerState = event.answerState ? { ...event.answerState } : session.answerState;
      if (type === 'batch_answer_no_response') {
        session.batchState.pendingNoResponse = {
          batchId: String(event.batchId || ''),
          memberIds,
          answerState: event.answerState || null,
          at: now
        };
        session.batchState.answerHandoff = event.handoff ? { ...event.handoff } : session.batchState.answerHandoff;
      } else {
        session.batchState.pendingNoResponse = null;
      }
      session.batchState.active = null;
    } else if (type === 'batch_submit_failed') {
      session.batchState.active = null;
      session.batchState.next = { memberIds, questionCount: memberIds.length, written: true };
    } else if (type === 'draft_conflict') {
      session.batchState.draftConflict = { owner: String(event.owner || 'unknown'), state: 'unresolved', at: now };
    } else if (type === 'draft_conflict_resolved') {
      session.batchState.draftConflict = {
        owner: String(event.owner || 'unknown'),
        state: String(event.action || 'resolved'),
        at: now
      };
    } else if (type === 'batch_schedule_evaluated') {
      session.batchState.scheduling = {
        memberIds,
        urgency: String(event.urgency || ''),
        reason: String(event.reason || ''),
        ageMs: Math.max(0, Number(event.ageMs) || 0),
        submitRecommended: Boolean(event.submitRecommended),
        evaluatedAt: Number(event.evaluatedAt || now)
      };
    } else if (type === 'batch_policy_changed') {
      if ('hold' in event) session.batchState.hold = Boolean(event.hold);
      if ('autoSubmit' in event) session.batchState.autoSubmit = Boolean(event.autoSubmit);
    } else if (type === 'receiver_delivery_policy_changed' || type === 'post_answer_policy') {
      session.batchState.receiverPolicy = event.policy ? { ...event.policy } : session.batchState.receiverPolicy;
    } else if (type === 'answer_acknowledged') {
      session.batchState.answerAcknowledgement = { ...safeEventData(event) };
    } else if (type === 'no_response_resolved') {
      session.batchState.pendingNoResponse = String(event.action || '') === 'wait' ? session.batchState.pendingNoResponse : null;
    } else if (type === 'interrupt_preview_created') {
      session.batchState.interruptPlan = { ...safeEventData(event) };
    } else if (type === 'batch_interrupted') {
      session.batchState.interruptPlan = null;
    }
    session.batchState.lastEvent = { ...safeEventData(event), at: now };
    session.batchState.updatedAt = Math.max(
      Math.max(0, Number(session.batchState.updatedAt || 0)),
      Math.max(0, Number(now || 0))
    );
    session.updatedAt = now;
    this.record(sessionId, type, event, now);
    return { ...session.batchState };
  }

  setStoragePressure(sessionId, pressure, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    session.storagePressure = { ...(pressure || {}) };
    session.updatedAt = now;
    return { ...session.storagePressure };
  }

  compactTransientHistory(sessionId, { timelineRetain = 80, metricRetain = 20, commandRetain = 64 } = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const before = {
      timeline: session.timeline.length,
      commands: session.commandJournal.size,
      proofSamples: session.metrics.deliveryProofMs.length,
      answerSamples: session.metrics.answerElapsedMs.length,
      answerWordSamples: session.metrics.answerWordCounts.length
    };
    session.timeline = session.timeline.slice(-Math.max(20, Number(timelineRetain) || 80));
    const compactedCommands = session.commandJournal.compact(Math.max(16, Number(commandRetain) || 64));
    const metricLimit = Math.max(10, Number(metricRetain) || 20);
    session.metrics.deliveryProofMs = session.metrics.deliveryProofMs.slice(-metricLimit);
    session.metrics.answerElapsedMs = session.metrics.answerElapsedMs.slice(-metricLimit);
    session.metrics.answerWordCounts = session.metrics.answerWordCounts.slice(-metricLimit);
    const removed = (before.timeline - session.timeline.length)
      + compactedCommands
      + (before.proofSamples - session.metrics.deliveryProofMs.length)
      + (before.answerSamples - session.metrics.answerElapsedMs.length)
      + (before.answerWordSamples - session.metrics.answerWordCounts.length);
    if (removed > 0) this.record(sessionId, 'transient_history_compacted', { removed, before }, now);
    return removed;
  }

  compactProvenHistory(sessionId, retain = 80, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const removed = session.ledger.compactProven(retain);
    if (!removed.length) return 0;
    session.proofArchive = {
      count: Number(session.proofArchive?.count || 0) + removed.length,
      lastProvenAt: Math.max(
        Number(session.proofArchive?.lastProvenAt || 0),
        ...removed.map(item => Number(item.proof?.at || item.updatedAt || 0))
      )
    };
    this.record(sessionId, 'proven_history_compacted', {
      count: removed.length,
      retained: retain,
      archiveCount: session.proofArchive.count
    }, now);
    return removed.length;
  }

  setLayout(sessionId, layout, now = Date.now(), { pushHistory = false, record = true } = {}) {
    const session = this.ensure(sessionId, now);
    if (pushHistory) session.layout.history = pushLayoutHistory(session.layout.history, session.layout, now);
    session.layout = {
      ...session.layout,
      ...(layout || {}),
      history: normalizeLayoutHistory(layout?.history || session.layout.history)
    };
    session.updatedAt = now;
    if (record) this.record(sessionId, 'layout_changed', {
      mode: session.layout.mode,
      hidden: session.layout.hidden,
      focusedRole: session.layout.focusedRole,
      historyDepth: session.layout.history.length
    }, now);
    return JSON.parse(JSON.stringify(session.layout));
  }

  popLayoutHistory(sessionId, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const popped = popLayoutHistory(session.layout.history);
    session.layout.history = popped.history;
    session.updatedAt = now;
    return popped.value ? { ok: true, value: { ...popped.value }, history: [...popped.history] } : { ok: false, error: 'layout_history_empty', history: [] };
  }

  setRepair(sessionId, report, now = Date.now(), { record = true } = {}) {
    const session = this.ensure(sessionId, now);
    session.lastRepair = { ...(report || {}), at: now };
    session.updatedAt = now;
    if (record) this.record(sessionId, 'repair_report', session.lastRepair, now);
  }

  record(sessionId, type, data = {}, now = Date.now()) {
    const session = this.ensure(sessionId, now);
    const eventType = String(type || 'event');
    const eventData = safeEventData(data);
    if (eventType === 'receiver_proof') {
      session.latestProof = { ...eventData, at: now };
    }
    session.timeline.push({
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      at: now,
      type: eventType,
      data: eventData
    });
    session.timeline = session.timeline.slice(-MAX_TIMELINE);
    session.updatedAt = now;
  }

  snapshot(sessionId, now = Date.now()) {
    const session = this.#sessions.get(String(sessionId || '').trim());
    if (!session) return null;
    const warnings = [];
    for (const role of ROLE_NAMES) {
      const state = session[role];
      if (!state.connected) warnings.push({ code: `${role}_missing`, role, severity: 'error' });
      else if (state.adapterCapabilities?.complete === false) {
        warnings.push({
          code: `${role}_adapter_incomplete`,
          role,
          severity: 'error',
          missing: state.adapterCapabilities.missingRequired || []
        });
      }
      else if (state.phase === 'unresponsive') {
        warnings.push({ code: `${role}_unresponsive`, role, severity: 'error' });
      } else if (state.phase && state.phase !== 'ready') {
        warnings.push({
          code: `${role}_lifecycle_not_ready`,
          role,
          severity: 'warn',
          phase: state.phase
        });
      } else if (state.heartbeatAt && now - state.heartbeatAt > 15_000) {
        warnings.push({ code: `${role}_heartbeat_stale`, role, severity: 'error', ageMs: now - state.heartbeatAt });
      } else if (!state.composerReady) {
        warnings.push({ code: `${role}_composer_missing`, role, severity: 'warn' });
      }
    }
    if (session.latestProof?.ok && session.latestProof?.verified === false) {
      warnings.push({ code: 'receiver_proof_unverified', severity: 'error' });
    }
    if (session.latestProof?.ok === false) {
      warnings.push({
        code: 'receiver_proof_failed',
        severity: 'error',
        reason: session.latestProof.reason || 'unknown'
      });
    }
    if (session.sender.sourceSilenceState === 'voice_stalled') {
      warnings.push({
        code: 'sender_voice_transcript_stalled',
        severity: 'error',
        ageMs: session.sender.sourceSilenceMs || 0
      });
    } else if (session.sender.sourceSilenceState === 'voice_slow') {
      warnings.push({
        code: 'sender_voice_transcript_slow',
        severity: 'warn',
        ageMs: session.sender.sourceSilenceMs || 0
      });
    } else if (session.sender.sourceSilenceState === 'idle_silent') {
      warnings.push({
        code: 'sender_source_silent',
        severity: 'warn',
        ageMs: session.sender.sourceSilenceMs || 0
      });
    }
    const unresolved = session.ledger.unresolved();
    const proofEvents = session.timeline.filter(event => event.type === 'batch_proven').map(event => ({ at: event.at }));
    const deliveryForecast = deriveBacklogForecast({ queued: unresolved.length, oldestAgeMs: unresolved.length ? Math.max(0, now - Math.min(...unresolved.map(item => Number(item.persistedAt) || now))) : 0, targetMs: Number(session.deliverySla?.targetMs || 20000), proofLatenciesMs: session.metrics.deliveryProofMs, proofs: proofEvents }, now);
    if (unresolved.length) warnings.push({ code: 'inbox_waiting', severity: 'warn', count: unresolved.length });
    const oldestPersistedAt = unresolved.length
      ? Math.min(...unresolved.map(item => Number(item.persistedAt) || now))
      : 0;
    if (oldestPersistedAt && now - oldestPersistedAt >= 120_000) {
      warnings.push({
        code: 'inbox_oldest_stale',
        severity: 'error',
        ageMs: now - oldestPersistedAt
      });
    }
    if (['unresolved', 'keep_manual'].includes(session.batchState.draftConflict?.state)) {
      warnings.push({ code: 'receiver_draft_conflict', severity: 'warn' });
    }
    if (session.storagePressure?.level === 'critical') warnings.push({ code: 'session_storage_critical', severity: 'error', percent: session.storagePressure.percent });
    else if (session.storagePressure?.level === 'high') warnings.push({ code: 'session_storage_high', severity: 'warn', percent: session.storagePressure.percent });
    else if (session.storagePressure?.level === 'elevated') warnings.push({ code: 'session_storage_elevated', severity: 'warn', percent: session.storagePressure.percent });
    if (session.mode === 'repairing') warnings.push({ code: 'repair_in_progress', severity: 'warn' });
    if (session.mode === 'degraded') warnings.push({ code: 'runtime_degraded', severity: 'error' });
    if (session.mode === 'blocked') warnings.push({ code: 'runtime_blocked', severity: 'error' });
    if (session.mode === 'paused') warnings.push({ code: 'transport_paused', severity: 'warn' });
    return {
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      now,
      uptimeMs: Math.max(0, now - session.createdAt),
      mode: session.mode,
      sender: { ...session.sender },
      receiver: { ...session.receiver },
      comparison: { ...session.comparison },
      latestPreview: session.latestPreview ? { ...session.latestPreview } : null,
      latestFinal: session.latestFinal ? { ...session.latestFinal } : null,
      latestProof: session.latestProof ? { ...session.latestProof } : null,
      batchState: { ...session.batchState, active: session.batchState.active ? { ...session.batchState.active } : null, next: session.batchState.next ? { ...session.batchState.next } : null },
      ledger: session.ledger.snapshot(),
      ledgerCounts: session.ledger.counts(),
      ledgerIndexAudit: session.ledger.indexAudit({ repair: false }),
      warnings,
      timeline: session.timeline.map(event => ({ ...event, data: { ...event.data } })),
      commandJournal: session.commandJournal.recent(5),
      deliverySla: { ...(session.deliverySla || {}) },
      deliveryPolicy: { ...(session.deliveryPolicy || {}) },
      consistencyAudit: session.consistencyAudit ? JSON.parse(JSON.stringify(session.consistencyAudit)) : null,
      recoverySchedules: (session.recoverySchedules || []).map(value => ({ ...value })),
      endGuard: session.endGuard ? { ...session.endGuard, counts: { ...(session.endGuard.counts || {}) } } : null,
      senderOutboxState: { ...normalizeOutboxState(session.senderOutboxState) },
      selfTest: session.selfTest ? JSON.parse(JSON.stringify(session.selfTest)) : null,
      answerState: session.answerState ? { ...session.answerState } : null,
      recoveryBudget: session.recoveryBudget.snapshot(now),
      performanceBudget: session.performanceBudget.snapshot(),
      turnPerformance: deriveTurnCoordinationPerformance(session.metrics.turnCoordination, now),
      deliveryForecast,
      lastTransportDrill: session.lastTransportDrill ? JSON.parse(JSON.stringify(session.lastTransportDrill)) : null,
      metrics: {
        ...session.metrics,
        turnCoordination: createTurnCoordinationPerformance(session.metrics.turnCoordination),
        deliverySuccessRate: session.metrics.delivered + session.metrics.failed
          ? Math.round((session.metrics.delivered / (session.metrics.delivered + session.metrics.failed)) * 100)
          : 100,
        averageDeliveryProofMs: average(session.metrics.deliveryProofMs),
        averageAnswerElapsedMs: average(session.metrics.answerElapsedMs),
        averageAnswerWords: average(session.metrics.answerWordCounts),
        maxAnswerWords: session.metrics.answerWordCounts.length ? Math.max(...session.metrics.answerWordCounts) : 0,
        answersOver180: session.metrics.answerWordCounts.filter(value => value > 180).length,
        answerAvailabilityRate: session.metrics.answersCompleted + session.metrics.answersNoResponse + session.metrics.answersTimedOut
          ? Math.round((session.metrics.answersCompleted / (session.metrics.answersCompleted + session.metrics.answersNoResponse + session.metrics.answersTimedOut)) * 100)
          : 100
      },
      dashboardConnections: session.dashboardConnections,
      layout: { ...session.layout },
      lastRepair: session.lastRepair ? { ...session.lastRepair } : null,
      endedAt: session.endedAt,
      storagePressure: { ...session.storagePressure },
      proofArchive: { ...session.proofArchive },
      contextArmed: session.contextArmed,
      contextArmedAt: session.contextArmedAt,
      liveSession: JSON.parse(JSON.stringify(session.liveSession || {})),
      questionOperations: {
        metadata: JSON.parse(JSON.stringify(session.questionOperations.metadata || {})),
        undoJournal: JSON.parse(JSON.stringify(session.questionOperations.undoJournal || []))
      },
      incidentControls: JSON.parse(JSON.stringify(session.incidentControls || { controls: {}, quietMode: false })),
      operatorMarkers: JSON.parse(JSON.stringify(session.operatorMarkers || [])),
      checkpoint: session.checkpoint ? JSON.parse(JSON.stringify(session.checkpoint)) : null,
      sloHistory: session.sloHistory.map(value => ({ ...value })),
      stabilizationRunbook: session.stabilizationRunbook ? JSON.parse(JSON.stringify(session.stabilizationRunbook)) : null,
      crashResumeDismissedAt: Math.max(0, Number(session.crashResumeDismissedAt || 0)),
      uiPreferences: JSON.parse(JSON.stringify(session.uiPreferences || { shortcutBindings: defaultShortcutBindings(), accessibility: normalizeAccessibilityPreferences() })),
      productionControls: JSON.parse(JSON.stringify(session.productionControls || normalizeProductionControls())),
      sessionNavigator: JSON.parse(JSON.stringify(session.sessionNavigator || normalizeSessionNavigator())),
      sessionNavigatorIntegrity: auditSessionNavigator({ sessionId: session.sessionId, sessionNavigator: session.sessionNavigator, ledger: session.ledger.snapshot(), operatorMarkers: session.operatorMarkers }, now)
    };
  }

  exportState() {
    return Array.from(this.#sessions.values()).map(session => ({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      mode: session.mode,
      sender: { ...session.sender },
      receiver: { ...session.receiver },
      comparison: { ...session.comparison },
      latestPreview: session.latestPreview,
      latestFinal: session.latestFinal,
      latestProof: session.latestProof,
      batchState: session.batchState,
      ledger: session.ledger.exportState(),
      timeline: session.timeline,
      metrics: session.metrics,
      commandJournal: session.commandJournal.exportState(),
      layout: session.layout,
      lastRepair: session.lastRepair,
      endedAt: session.endedAt,
      storagePressure: { ...session.storagePressure },
      proofArchive: { ...session.proofArchive },
      contextArmed: session.contextArmed,
      contextArmedAt: session.contextArmedAt,
      deliverySla: { ...(session.deliverySla || {}) },
      deliveryPolicy: { ...(session.deliveryPolicy || {}) },
      consistencyAudit: session.consistencyAudit ? JSON.parse(JSON.stringify(session.consistencyAudit)) : null,
      recoverySchedules: (session.recoverySchedules || []).map(value => ({ ...value })),
      endGuard: session.endGuard ? { ...session.endGuard, counts: { ...(session.endGuard.counts || {}) } } : null,
      senderOutboxState: { ...normalizeOutboxState(session.senderOutboxState) },
      selfTest: session.selfTest ? JSON.parse(JSON.stringify(session.selfTest)) : null,
      answerState: session.answerState ? { ...session.answerState } : null,
      recoveryBudget: session.recoveryBudget.snapshot(),
      performanceBudget: session.performanceBudget.exportState(),
      lastTransportDrill: session.lastTransportDrill ? JSON.parse(JSON.stringify(session.lastTransportDrill)) : null,
      liveSession: JSON.parse(JSON.stringify(session.liveSession || {})),
      questionOperations: {
        metadata: JSON.parse(JSON.stringify(session.questionOperations.metadata || {})),
        undoJournal: JSON.parse(JSON.stringify(session.questionOperations.undoJournal || []))
      },
      incidentControls: JSON.parse(JSON.stringify(session.incidentControls || { controls: {}, quietMode: false })),
      operatorMarkers: JSON.parse(JSON.stringify(session.operatorMarkers || [])),
      checkpoint: session.checkpoint ? JSON.parse(JSON.stringify(session.checkpoint)) : null,
      sloHistory: session.sloHistory.map(value => ({ ...value })),
      stabilizationRunbook: session.stabilizationRunbook ? JSON.parse(JSON.stringify(session.stabilizationRunbook)) : null,
      crashResumeDismissedAt: Math.max(0, Number(session.crashResumeDismissedAt || 0)),
      uiPreferences: JSON.parse(JSON.stringify(session.uiPreferences || { shortcutBindings: defaultShortcutBindings(), accessibility: normalizeAccessibilityPreferences() })),
      productionControls: JSON.parse(JSON.stringify(session.productionControls || normalizeProductionControls())),
      sessionNavigator: JSON.parse(JSON.stringify(session.sessionNavigator || normalizeSessionNavigator()))
    }));
  }
}

export function buildPilotSnapshot(state, sessionId, now = Date.now()) {
  return state instanceof RuntimePilotState ? state.snapshot(sessionId, now) : null;
}
