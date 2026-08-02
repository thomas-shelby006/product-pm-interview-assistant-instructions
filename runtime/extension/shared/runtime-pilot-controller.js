import { normalizeDashboardCommand, parseDashboardPortName } from './dashboard-protocol.js';
import { createRuntimePilotStore } from './runtime-pilot-store.js';
import { getRuntimeWindowLayout, windowUpdateForBounds } from './window-layout.js';
import { hasMeaningfulTelemetryChange, heartbeatPatch } from './telemetry-coalescer.js';
import { classifyStoragePressure, DEFAULT_SESSION_QUOTA_BYTES } from './storage-pressure.js';
import { buildReconciliationPayload } from './delivery-reconciler.js';
import { shouldPersistBatchEvent } from './batch-event-policy.js';
import { utf8Bytes } from './storage-accounting.js';
import { deriveDeliverySla } from './delivery-sla-policy.js';
import { createRuntimeRecoveryCoordinator } from './runtime-recovery-coordinator.js';
import { prepareSessionEnd, senderOutboxStorageKey, validateSessionEnd } from './session-end-guard.js';
import { runRuntimeSelfTest } from './runtime-self-test.js';
import { createSessionMutationCoordinator } from './session-mutation-coordinator.js';
import { buildSnapshotDelta } from './snapshot-delta.js';
import { SnapshotSectionCache } from './snapshot-section-cache.js';
import { createCoalescedCommitLane } from './persistence-urgency-policy.js';
import { outboxAlarmName } from './alarm-rehydration.js';
import { runTransportDrill } from './transport-drill.js';
import { deriveSequenceFeedback } from './sequence-feedback.js';
import { buildSafeSupportBundle } from './support-bundle.js';

import { classifyRegistration } from './registration-heartbeat.js';
import { classifyRuntimeRootCause } from './runtime-root-cause.js';
import { selectRecoveryAction } from './recovery-escalation-policy.js';
import { deriveQueueOnlyPolicy } from './queue-only-policy.js';
import { runConsistencyAudit } from './consistency-watchdog.js';
import { transitionSessionPhase } from './session-phase-model.js';
import { deriveInterviewRunbook } from './interview-runbook.js';
import { pauseSessionClock, resumeSessionClock, deriveSessionClock } from './session-clock.js';
import { deriveInterviewerSilence } from './interviewer-silence.js';
import { deriveAttentionTarget } from './attention-model.js';
import { deriveNextAction } from './next-action-model.js';
import { deriveSessionPhase } from './session-phase-model.js';
import { commandCatalog } from './operator-command-catalog.js';
import { deriveQuestionOperations } from './question-operations-state.js';
import { deriveIncidents, mergeIncidentState } from './incident-center.js';
import { deriveIncidentRunbook } from './incident-runbook.js';
import { deriveQuietAttention } from './quiet-attention-policy.js';
import { deriveBatchPreview } from './batch-preview-model.js';
import { validateQuestionRelation } from './question-relation-model.js';
import { deriveActivityMarkers } from './activity-markers.js';
import { deriveSessionCheckpoint } from './session-checkpoint.js';
import { deriveInterruptionRecoveryCard } from './interruption-recovery-card.js';
import { deriveSessionLandmarks } from './session-landmarks.js';
import { validateFocusGesture } from './focus-gesture-token.js';
import { normalizeWindowNavigationIntent } from './window-navigation-intent.js';
import { derivePreflightWizard } from './preflight-wizard.js';
import { deriveResumeGuard, validateResumeBoundary } from './resume-guard.js';
import { deriveCrashResume } from './crash-resume-model.js';
import { addSloSample, deriveSloTrend } from './slo-history.js';
import { advanceRunbook, cancelRunbook, startRunbook } from './stabilization-runbook.js';
import { filterOperationalEvents } from './operational-event-filter.js';
import { derivePerformanceHealth } from './performance-health.js';
import { deriveLiveUxMemoryBudget } from './live-ux-memory-budget.js';
import { deriveMechanicsHardeningReport } from './mechanics-hardening-report.js';
import { auditLiveCommandIntegrity, repairLiveCommandMetadata } from './live-command-integrity.js';
import { buildRestartContinuity } from './restart-continuity.js';
import { monotonicElapsed, normalizeMonotonicClock } from './monotonic-session-clock.js';
import { restoreManagedLayout } from './layout-restoration.js';
import { deriveOperatorDecisionCenter } from './operator-decision-center.js';
import { commandForChoice, deriveOperatorChoice, validateOperatorChoice } from './operator-choice-model.js';
import { deriveOperatingProfile } from './operating-profile.js';
import { validatePolicyImpactConfirmation } from './policy-impact-preview.js';
import { deriveContextualNavigation } from './cockpit-navigation.js';
import { applyContainmentOverride, deriveContainmentStatus } from './containment-status.js';
import { deriveTransportAssurance } from './transport-assurance.js';
import { deriveProviderRouteReadiness } from './provider-route-readiness.js';
import { deriveProviderRouteTransition } from './provider-route-transition.js';
import { deriveUpgradeReadiness } from './upgrade-readiness.js';
import { deriveLiveScorecard } from './live-scorecard.js';
import { deriveProductionDiagnostics } from './production-diagnostics.js';
import { deriveReleaseHandoff } from './release-handoff.js';

function safeError(error) {
  return String(error?.message || error || 'unknown_error');
}

function runtimeUrl(pageUrl, sessionId, role, provider) {
  try {
    const url = new URL(pageUrl);
    url.searchParams.set('pmia_session', sessionId);
    url.searchParams.set('pmia_role', role);
    url.searchParams.set('pmia_provider', provider);
    return url.href;
  } catch {
    return '';
  }
}

export function createRuntimePilotController({
  chromeApi = globalThis.chrome,
  storageArea,
  registryProvider,
  saveRegistry,
  deliverFinal,
  exportManagedSession,
  clearSessionLogs,
  requestRole = null
} = {}) {
  const store = createRuntimePilotStore({ storageArea });
  const ports = new Map();
  const recoveryCoordinator = createRuntimeRecoveryCoordinator({ chromeApi });
  const snapshotCaches = new Map();
  const snapshotPerformance = new Map();
  const deliveryPolicyApplied = new Map();
  const deliveryPolicyEstablished = new Set();
  const incidentStateCache = new Map();
  const consumedFocusGestures = new Set();
  const mutationCoordinator = createSessionMutationCoordinator();
  const coalescedCommitLane = createCoalescedCommitLane({
    delayMs: 60,
    commit: (sessionId, reasons) => mutationCoordinator.run(sessionId, async () => {
      const pilot = await state();
      if (!pilot.snapshot(sessionId)) return;
      await commit(sessionId, pilot, `coalesced:${reasons.join('+')}`);
    })
  });

  function sessionPorts(sessionId) {
    return ports.get(sessionId) || new Set();
  }

  function post(port, message) {
    try {
      port.postMessage(message);
      return true;
    } catch {
      return false;
    }
  }

  function sameDeliveryPolicy(left = {}, right = {}) {
    return Boolean(left.active) === Boolean(right.active)
      && String(left.reason || '') === String(right.reason || '')
      && String(left.resumeWhen || '') === String(right.resumeWhen || '')
      && Boolean(left.allowPersist) === Boolean(right.allowPersist)
      && Boolean(left.allowProviderWrite) === Boolean(right.allowProviderWrite);
  }

  async function syncDeliveryPolicy(sessionId, registry, pilot, { force = false } = {}) {
    const snapshot = pilot.snapshot(sessionId);
    if (!snapshot) return { active: false, reason: 'session_missing', allowPersist: true, allowProviderWrite: false };
    const rootCause = classifyRuntimeRootCause({ ...snapshot, stateAudit: store.audit() }, Date.now());
    const basePolicy = deriveQueueOnlyPolicy(snapshot, rootCause);
    const policy = applyContainmentOverride(basePolicy, snapshot, Date.now());
    const changed = !sameDeliveryPolicy(snapshot.deliveryPolicy, policy);
    const bothObserved = ['sender', 'receiver'].every(role => {
      const value = snapshot?.[role] || {};
      return Boolean(value.connected || value.tabId || value.instanceId || ['registered', 'ready'].includes(String(value.phase || '')));
    });
    if (bothObserved) deliveryPolicyEstablished.add(sessionId);
    if (changed) {
      const priorActive = Boolean(snapshot.deliveryPolicy?.active);
      pilot.setDeliveryPolicy(sessionId, policy);
      if (policy.active || priorActive) {
        pilot.record(sessionId, policy.active ? 'queue_only_enabled' : 'queue_only_cleared', {
          reason: policy.reason,
          resumeWhen: policy.resumeWhen,
          rootCause: rootCause.code
        });
      }
    }
    const receiverOwned = Boolean(registry?.getSession?.(sessionId)?.receiver);
    const applied = deliveryPolicyApplied.get(sessionId) === true;
    const shouldSync = deliveryPolicyEstablished.has(sessionId) && receiverOwned && (
      policy.active ? (changed || force || !applied) : applied
    );
    if (shouldSync) {
      const result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'set_queue_only', {
        value: policy.active,
        reason: policy.reason,
        source: 'runtime_policy'
      });
      if (result?.ok) deliveryPolicyApplied.set(sessionId, policy.active);
    }
    return { ...policy, changed, rootCause, synchronized: shouldSync };
  }

  async function runAndApplyConsistencyAudit(sessionId, pilot, registry = null) {
    const snapshot = pilot.snapshot(sessionId);
    if (!snapshot) return { ok: true, repairs: [], blocked: [], reason: 'session_missing' };
    let activeRegistry = registry;
    if (!activeRegistry) {
      try { activeRegistry = await registryProvider(); } catch { activeRegistry = null; }
    }
    let alarms = [];
    try { alarms = await chromeApi.alarms?.getAll?.() || []; } catch { alarms = []; }
    let audit = runConsistencyAudit({
      snapshot,
      storeAudit: store.audit(),
      registry: activeRegistry,
      alarms,
      now: Date.now()
    });
    for (const repair of audit.repairs || []) {
      if (repair.code === 'rebuild_ledger_index') {
        pilot.auditLedgerIndex(sessionId, { repair: true });
      } else if (repair.code === 'release_expired_attempt_lease' && repair.ledgerItemId) {
        pilot.releaseExpiredAttemptLease(sessionId, repair.ledgerItemId);
      } else if (repair.code === 'restore_alarm' && repair.alarmName) {
        const schedule = snapshot.recoverySchedules?.find(item => item.alarmName === repair.alarmName);
        if (schedule?.dueAt) {
          await chromeApi.alarms?.create?.(repair.alarmName, { when: Math.max(Date.now() + 50, Number(schedule.dueAt)) });
        }
      }
    }
    if ((audit.repairs || []).some(item => ['rebuild_ledger_index','release_expired_attempt_lease','restore_alarm'].includes(item.code))) {
      let refreshedAlarms = [];
      try { refreshedAlarms = await chromeApi.alarms?.getAll?.() || []; } catch { refreshedAlarms = []; }
      audit = runConsistencyAudit({
        snapshot: pilot.snapshot(sessionId),
        storeAudit: store.audit(),
        registry: activeRegistry,
        alarms: refreshedAlarms,
        now: Date.now()
      });
    }
    pilot.setConsistencyAudit(sessionId, audit);
    return audit;
  }

  async function state() {
    return store.load();
  }

  async function refreshDerivedPolicies(sessionId, pilot, { registry = null } = {}) {
    const base = pilot.snapshot(sessionId);
    if (!base) return { rootCause: null, deliveryPolicy: null, consistencyAudit: null };
    let currentRegistry = registry;
    if (!currentRegistry) {
      try { currentRegistry = await registryProvider(); } catch { currentRegistry = null; }
    }
    const consistencyAudit = await runAndApplyConsistencyAudit(sessionId, pilot, currentRegistry);
    const deliveryPolicy = await syncDeliveryPolicy(sessionId, currentRegistry, pilot);
    return {
      rootCause: deliveryPolicy.rootCause,
      deliveryPolicy,
      consistencyAudit
    };
  }

  function blockedStateSnapshot(sessionId, error = null) {
    const now = Date.now();
    return {
      sessionId: String(sessionId || ''),
      createdAt: now,
      updatedAt: now,
      now,
      uptimeMs: 0,
      mode: 'blocked',
      sender: { connected: false, phase: 'missing', composerReady: false, provider: '' },
      receiver: { connected: false, phase: 'missing', composerReady: false, provider: '' },
      ledger: [],
      ledgerCounts: { pending: 0, inFlight: 0, proven: 0, archived: 0, failed: 0 },
      warnings: [{ code: 'runtime_state_blocked', severity: 'error', reason: safeError(error) }],
      timeline: [],
      commandJournal: [],
      metrics: {},
      dashboardConnections: sessionPorts(sessionId).size,
      stateAudit: store.audit()
    };
  }

  async function broadcast(sessionId, pilot = null) {
    const current = pilot || await state();
    const baseSnapshot = current.snapshot(sessionId, Date.now());
    const localPerformance = snapshotPerformance.get(sessionId) || { cacheHits: 0, cacheMisses: 0 };
    const stateAudit = store.audit();
    const snapshotBase = baseSnapshot ? { ...baseSnapshot, stateAudit } : null;
    const rootCause = snapshotBase ? classifyRuntimeRootCause(snapshotBase, Date.now()) : null;
    const deliveryPolicy = snapshotBase ? applyContainmentOverride(deriveQueueOnlyPolicy(snapshotBase, rootCause), snapshotBase, Date.now()) : null;
    const enrichedBase = snapshotBase ? { ...snapshotBase, rootCause, deliveryPolicy } : null;
    const derivedIncidents = enrichedBase ? deriveIncidents(enrichedBase, Date.now()) : [];
    const incidents = enrichedBase ? mergeIncidentState(
      derivedIncidents,
      enrichedBase.incidentControls?.controls || {},
      incidentStateCache.get(sessionId) || [],
      Date.now()
    ) : [];
    if (enrichedBase) incidentStateCache.set(sessionId, incidents);
    else incidentStateCache.delete(sessionId);
    const baseAttention = enrichedBase ? deriveAttentionTarget(enrichedBase, Date.now()) : null;
    const quietAttention = enrichedBase ? deriveQuietAttention(
      { incidents, attention: baseAttention },
      Boolean(enrichedBase.incidentControls?.quietMode),
      Date.now()
    ) : null;
    const primaryIncident = quietAttention?.visibleIncidents?.[0] || null;
    const activityMarkers = enrichedBase ? deriveActivityMarkers(enrichedBase.timeline || []) : [];
    const sessionLandmarks = enrichedBase ? deriveSessionLandmarks({
      timeline: enrichedBase.timeline || [],
      operatorMarkers: enrichedBase.operatorMarkers || [],
      activityMarkers
    }) : [];
    const recoveryCard = enrichedBase ? deriveInterruptionRecoveryCard(enrichedBase, enrichedBase.checkpoint, Date.now()) : null;
    const liveOperations = enrichedBase ? {
      phase: deriveSessionPhase(enrichedBase),
      runbook: deriveInterviewRunbook(enrichedBase, Date.now()),
      clock: deriveSessionClock(enrichedBase.liveSession || {}, Date.now()),
      silence: deriveInterviewerSilence(enrichedBase, Date.now()),
      attention: quietAttention.attention,
      nextAction: deriveNextAction({ ...enrichedBase, attention: quietAttention.attention }, Date.now()),
      commands: commandCatalog(enrichedBase),
      quietAttention
    } : null;
    let production = null;
    if (enrichedBase) {
      const productionBase = { ...enrichedBase, deliveryPolicy, incidents: { items: incidents }, liveOperations };
      const decisionCenter = deriveOperatorDecisionCenter(productionBase, Date.now());
      const operatingProfile = deriveOperatingProfile(productionBase);
      const containment = deriveContainmentStatus(productionBase, Date.now());
      const transportAssurance = deriveTransportAssurance(productionBase, Date.now());
      const routeTransition = deriveProviderRouteTransition(productionBase, productionBase.routeTransition?.target || {});
      const routeReadiness = deriveProviderRouteReadiness({ ...productionBase, routeTransition });
      const upgradeReadiness = deriveUpgradeReadiness(productionBase);
      const scorecard = deriveLiveScorecard(productionBase);
      const navigation = deriveContextualNavigation({ ...productionBase, production: { decisionCenter } });
      const partial = { decisionCenter, operatingProfile, containment, transportAssurance, routeTransition, routeReadiness, upgradeReadiness, scorecard, navigation };
      const diagnostics = deriveProductionDiagnostics(productionBase, partial);
      const releaseHandoff = deriveReleaseHandoff(productionBase, { ...partial, diagnostics }, productionBase.releaseEvidence || {});
      production = { ...partial, diagnostics, releaseHandoff };
    }
    const rawSnapshot = snapshotBase ? {
      ...snapshotBase,
      rootCause,
      deliveryPolicy,
      production,
      liveOperations,
      incidents: {
        items: incidents,
        quietMode: Boolean(snapshotBase.incidentControls?.quietMode),
        hiddenCount: Number(quietAttention?.hiddenCount || 0),
        currentRunbook: primaryIncident ? deriveIncidentRunbook(primaryIncident, enrichedBase) : null
      },
      activityMarkers,
      sessionLandmarks,
      recoveryCard,
      questionOperationsDerived: deriveQuestionOperations(enrichedBase, Date.now()),
      operatorChoice: deriveOperatorChoice(enrichedBase, Date.now()),
      batchPreview: deriveBatchPreview(enrichedBase),
      preflightWizard: derivePreflightWizard(enrichedBase),
      resumeGuard: deriveResumeGuard(enrichedBase),
      crashResume: deriveCrashResume(enrichedBase, Date.now()),
      operationalReview: {
        events: filterOperationalEvents(enrichedBase.timeline || [], { limit: 80 }),
        sloTrend: deriveSloTrend(enrichedBase.sloHistory || []),
        stabilization: enrichedBase.stabilizationRunbook || null,
        performanceHealth: derivePerformanceHealth(enrichedBase)
      },
      liveUxBudget: deriveLiveUxMemoryBudget(enrichedBase),
      liveCommandIntegrity: auditLiveCommandIntegrity(enrichedBase, Date.now()),
      restartContinuity: buildRestartContinuity(enrichedBase, Date.now()),
      monotonicClock: {
        ...normalizeMonotonicClock(enrichedBase.liveSession?.monotonicClock || {}, Date.now(), globalThis.performance?.now?.() || 0),
        elapsedMs: monotonicElapsed(enrichedBase.liveSession?.monotonicClock || {}, globalThis.performance?.now?.() || 0)
      },
      restoredLayoutPreview: restoreManagedLayout(enrichedBase.layout || {}, [{ left: 0, top: 0, width: 1920, height: 1080 }]),
      mechanicsHardening: deriveMechanicsHardeningReport(enrichedBase, { sessions: [enrichedBase], windows: [] }),
      performanceBudget: {
        ...(snapshotBase.performanceBudget || {}),
        cacheHits: localPerformance.cacheHits,
        cacheMisses: localPerformance.cacheMisses,
        cacheHitRate: localPerformance.cacheHits + localPerformance.cacheMisses
          ? Math.round((localPerformance.cacheHits / (localPerformance.cacheHits + localPerformance.cacheMisses)) * 100)
          : 100
      }
    } : null;
    if (!rawSnapshot) {
      snapshotCaches.delete(sessionId);
      snapshotPerformance.delete(sessionId);
    }
    const cache = rawSnapshot
      ? (snapshotCaches.get(sessionId) || new SnapshotSectionCache())
      : null;
    if (cache && !snapshotCaches.has(sessionId)) snapshotCaches.set(sessionId, cache);
    const cached = cache ? cache.update(rawSnapshot) : null;
    if (cached) {
      snapshotPerformance.set(sessionId, {
        cacheHits: localPerformance.cacheHits + cached.reusedKeys.length,
        cacheMisses: localPerformance.cacheMisses + cached.changedKeys.length
      });
    }
    const snapshot = cached ? cached.snapshot : null;
    for (const entry of sessionPorts(sessionId)) {
      if (!snapshot) {
        if (post(entry.port, { type: 'PMIA_DASHBOARD_SESSION_ENDED', sessionId, snapshot: null })) {
          entry.lastSnapshot = null;
          entry.generation = 0;
        }
        continue;
      }
      if (!entry.lastSnapshot) {
        const nextGeneration = Math.max(1, Number(entry.generation || 0) + 1);
        if (post(entry.port, { type: 'PMIA_DASHBOARD_SNAPSHOT', sessionId, snapshot, generation: nextGeneration })) {
          entry.lastSnapshot = snapshot;
          entry.generation = nextGeneration;
        }
        continue;
      }
      const nextGeneration = Math.max(1, Number(entry.generation || 0) + 1);
      const delta = buildSnapshotDelta(entry.lastSnapshot, snapshot, { baseGeneration: entry.generation, nextGeneration });
      if (delta.empty) continue;
      if (post(entry.port, { type: 'PMIA_DASHBOARD_DELTA', sessionId, delta })) {
        entry.lastSnapshot = snapshot;
        entry.generation = nextGeneration;
      }
    }
    return snapshot;
  }

  async function commit(sessionId, pilot = null, reason = 'semantic_commit', { skipConsistency = false } = {}) {
    const current = pilot || await state();
    const auditEligible = !/^coalesced:(preview|batch_checkpoint)$/.test(String(reason || ''));
    if (!skipConsistency && auditEligible) await refreshDerivedPolicies(sessionId, current);
    if (auditEligible) {
      const checkpointSource = current.snapshot(sessionId);
      if (checkpointSource && !['ended'].includes(String(checkpointSource.liveSession?.phase || ''))) {
        current.setCheckpoint(sessionId, deriveSessionCheckpoint(checkpointSource, Date.now(), reason), Date.now(), { record: false });
      }
    }
    current.recordPerformance(sessionId, {
      kind: 'persistence',
      operations: 1,
      bytes: utf8Bytes(current.exportState()),
      budget: 1,
      reason
    });
    await store.save(current);
    const bytes = await store.bytesInUse().catch(() => 0);
    const quota = Number(storageArea?.QUOTA_BYTES || DEFAULT_SESSION_QUOTA_BYTES);
    let breakdown = store.estimate(current);
    const pressure = classifyStoragePressure(bytes, quota, breakdown);
    const prior = current.snapshot(sessionId)?.storagePressure;
    if (!prior || prior.level !== pressure.level || Math.abs(Number(prior.percent || 0) - pressure.percent) >= 1) {
      current.setStoragePressure(sessionId, pressure);
      if (pressure.level === 'high') {
        current.compactTransientHistory(sessionId, { timelineRetain: 100, metricRetain: 24 });
        current.compactProvenHistory(sessionId, 80);
      }
      if (pressure.level === 'critical') {
        current.compactTransientHistory(sessionId, { timelineRetain: 50, metricRetain: 12, commandRetain: 32 });
        current.compactProvenHistory(sessionId, 20);
      }
      breakdown = store.estimate(current);
      current.setStoragePressure(sessionId, classifyStoragePressure(bytes, quota, breakdown));
      await store.save(current);
    }
    return broadcast(sessionId, current);
  }

  function broadcastHeartbeat(sessionId, role, roleState) {
    const patch = heartbeatPatch(roleState);
    for (const entry of sessionPorts(sessionId)) {
      if (post(entry.port, { type: 'PMIA_DASHBOARD_HEARTBEAT', sessionId, role, patch })) {
        if (entry.lastSnapshot) {
          entry.lastSnapshot = {
            ...entry.lastSnapshot,
            [role]: { ...entry.lastSnapshot[role], ...patch }
          };
        }
      }
    }
  }

  function schedulePreviewCommit(sessionId) {
    return coalescedCommitLane.schedule(sessionId, 'preview');
  }

  async function tabState(tabId) {
    try {
      const tab = await chromeApi.tabs.get(tabId);
      return {
        tabId,
        windowId: Number.isInteger(tab?.windowId) ? tab.windowId : null,
        pageUrl: String(tab?.url || '')
      };
    } catch {
      return { tabId, windowId: null, pageUrl: '' };
    }
  }

  function currentRecoveryChecks(snapshot, overrides = {}) {
    const senderReady = Boolean(snapshot?.sender?.connected && snapshot.sender.phase === 'ready' && snapshot.sender.composerReady);
    const receiverReady = Boolean(snapshot?.receiver?.connected && snapshot.receiver.phase === 'ready' && snapshot.receiver.composerReady);
    return {
      sender: senderReady,
      receiver: receiverReady,
      adapters: snapshot?.sender?.adapterCapabilities?.complete === true
        && snapshot?.receiver?.adapterCapabilities?.complete === true,
      reconciliation: Boolean(snapshot?.lastRepair?.checks?.reconciliation),
      batch: !snapshot?.batchState?.draftConflict,
      storage: snapshot?.storagePressure?.level !== 'critical',
      ...overrides
    };
  }

  function persistRepairReport(pilot, sessionId, report, now = Date.now()) {
    return recoveryCoordinator.persistReport(pilot, sessionId, report, now);
  }

  function applyRecoveryTransition(pilot, sessionId, event) {
    return recoveryCoordinator.applyTransition(pilot, sessionId, event);
  }

  async function reconcileSession(sessionId, {
    registry = null,
    pilot = null,
    commitResult = true
  } = {}) {
    const currentRegistry = registry || await registryProvider();
    const currentPilot = pilot || await state();
    const snapshot = currentPilot.snapshot(sessionId);
    if (!snapshot?.receiver?.connected) return { ok: false, error: 'receiver_missing' };
    if (snapshot?.deliveryPolicy?.active || snapshot?.deliveryPolicy?.allowProviderWrite === false) {
      return { ok: true, queued: true, reason: snapshot.deliveryPolicy?.reason || 'queue_only' };
    }
    const payload = buildReconciliationPayload(snapshot);
    if (!payload.pending.length) {
      if (currentPilot.snapshot(sessionId)?.mode === 'repairing') {
        applyRecoveryTransition(currentPilot, sessionId, {
          type: 'checks_updated',
          checks: currentRecoveryChecks(currentPilot.snapshot(sessionId), { reconciliation: true }),
          storageCritical: currentPilot.snapshot(sessionId)?.storagePressure?.level === 'critical'
        });
        applyRecoveryTransition(currentPilot, sessionId, { type: 'verify' });
        if (commitResult) await commit(sessionId, currentPilot);
      }
      return { ok: true, reason: 'ledger_clean' };
    }
    const result = await sendRuntimeCommand(
      currentRegistry,
      sessionId,
      'receiver',
      'reconcile_delivery',
      payload
    );
    currentPilot.record(sessionId, 'delivery_reconciliation', {
      ok: Boolean(result.ok),
      pendingCount: payload.pending.length,
      batchCount: payload.batches.length,
      error: result.error || ''
    });
    if (currentPilot.snapshot(sessionId)?.mode === 'repairing') {
      applyRecoveryTransition(currentPilot, sessionId, {
        type: 'checks_updated',
        checks: currentRecoveryChecks(currentPilot.snapshot(sessionId), { reconciliation: result.ok !== false }),
        storageCritical: currentPilot.snapshot(sessionId)?.storagePressure?.level === 'critical'
      });
      applyRecoveryTransition(currentPilot, sessionId, { type: 'verify' });
    }
    if (commitResult) await commit(sessionId, currentPilot);
    return result;
  }

  async function transportLane(value = {}) {
    const sessionId = String(value.sessionId || '').trim();
    const role = String(value.role || '');
    if (!sessionId || !['sender', 'receiver'].includes(role)) return { ok: false, error: 'invalid_transport_lane' };
    const pilot = await state();
    pilot.updateTransportLane(sessionId, role, {
      state: value.state,
      lastMode: value.lastMode,
      lastRttMs: value.lastRttMs,
      consecutiveFailures: value.consecutiveFailures,
      nextProbeAt: value.nextProbeAt,
      lastFailureReason: value.lastFailureReason,
      score: value.score,
      scoreState: value.scoreState,
      preferredMode: value.preferredMode,
      scoreReason: value.scoreReason,
      protocolVersion: value.protocolVersion,
      epoch: value.epoch,
      capabilities: Array.isArray(value.capabilities) ? value.capabilities.map(String) : [],
      handshakeReady: Boolean(value.handshakeReady),
      updatedAt: value.updatedAt
    });
    await commit(sessionId, pilot);
    return { ok: true };
  }

  async function syncRegistration(registration) {
    const pilot = await state();
    const previous = pilot.snapshot(registration.sessionId)?.[registration.role] || null;
    const classification = classifyRegistration(previous?.tabId ? {
      role: registration.role,
      provider: previous.provider,
      tabId: previous.tabId,
      instanceId: previous.instanceId || ''
    } : null, registration);
    const tab = await tabState(registration.tabId);
    const heartbeatCount = Math.max(0, Number(previous?.registrationHeartbeatCount || 0))
      + (classification === 'heartbeat' ? 1 : 0);
    pilot.updateRole(registration.sessionId, registration.role, {
      ...tab,
      role: registration.role,
      instanceId: String(registration.instanceId || ''),
      provider: registration.provider,
      phase: previous?.phase === 'ready' ? 'ready' : 'registered',
      heartbeatAt: registration.registeredAt || Date.now(),
      lastRegistrationAt: registration.registeredAt || Date.now(),
      registrationHeartbeatCount: heartbeatCount,
      ownerGeneration: Math.max(0, Number(registration.ownerGeneration) || 0),
      leaseExpiresAt: Math.max(0, Number(registration.leaseExpiresAt) || 0)
    });
    if (classification === 'heartbeat') {
      return { ok: true, classification, persisted: false };
    }
    pilot.record(registration.sessionId, `registration_${classification}`, {
      role: registration.role,
      provider: registration.provider,
      tabId: registration.tabId,
      instanceId: String(registration.instanceId || ''),
      ownerGeneration: Math.max(0, Number(registration.ownerGeneration) || 0),
      leaseExpiresAt: Math.max(0, Number(registration.leaseExpiresAt) || 0)
    });
    await commit(registration.sessionId, pilot);
    if (registration.role === 'receiver') {
      try {
        const registry = await registryProvider();
        await syncDeliveryPolicy(registration.sessionId, registry, pilot, { force: true });
      } catch {}
      setTimeout(() => {
        void mutationCoordinator.run(
          registration.sessionId,
          () => reconcileSession(registration.sessionId)
        );
      }, 0);
    }
    return { ok: true, classification, persisted: true };
  }

  async function handlePreview({ preview, deliver }) {
    const pilot = await state();
    pilot.recordPreview(preview.sessionId, preview);
    const paused = pilot.snapshot(preview.sessionId)?.mode === 'paused';
    schedulePreviewCommit(preview.sessionId);
    if (paused) {
      return {
        ok: true,
        delivered: false,
        dropped: true,
        suppressed: true,
        reason: 'transport_paused'
      };
    }
    return deliver();
  }

  async function beforeForward(envelope) {
    let pilot = await state();
    if (envelope.kind === 'boot') {
      pilot.recordFinal(envelope.sessionId, envelope);
      await commit(envelope.sessionId, pilot);
      return { paused: false, persisted: true, duplicate: false, response: null };
    }
    const snapshot = pilot.snapshot(envelope.sessionId);
    const quota = Number(storageArea?.QUOTA_BYTES || DEFAULT_SESSION_QUOTA_BYTES);
    const bytes = await store.bytesInUse().catch(() => 0);
    const projected = bytes + utf8Bytes(envelope) + 1024;
    if (snapshot?.storagePressure?.level === 'critical' || projected >= quota * .985) {
      pilot.setStoragePressure(envelope.sessionId, classifyStoragePressure(projected, quota, store.estimate(pilot)));
      await broadcast(envelope.sessionId, pilot);
      return {
        paused: true,
        persisted: false,
        duplicate: false,
        response: { ok: false, persisted: false, error: 'storage_pressure' }
      };
    }
    const priorState = pilot.exportState();
    const persisted = pilot.persistFinal(envelope.sessionId, envelope);
    try {
      await commit(envelope.sessionId, pilot);
    } catch (error) {
      store.resetCache();
      pilot = null;
      return {
        paused: true,
        persisted: false,
        duplicate: false,
        response: {
          ok: false,
          persisted: false,
          error: /quota|space|storage/i.test(safeError(error)) ? 'storage_pressure' : 'persist_failed',
          rollbackState: priorState.length
        }
      };
    }
    if (!persisted.accepted) {
      return {
        paused: true,
        persisted: false,
        duplicate: false,
        response: { ok: false, persisted: false, error: persisted.reason || 'persist_failed' }
      };
    }
    if (persisted.duplicate) {
      return {
        paused: true,
        persisted: true,
        duplicate: true,
        response: {
          ok: true,
          persisted: true,
          duplicate: true,
          delivered: persisted.entry?.state === 'proven',
          queued: persisted.entry?.state !== 'proven',
          reason: 'duplicate_persisted'
        }
      };
    }
    const persistedSnapshot = pilot.snapshot(envelope.sessionId);
    if (persistedSnapshot?.mode === 'paused') {
      return {
        paused: true,
        persisted: true,
        duplicate: false,
        response: { ok: true, persisted: true, delivered: false, queued: true, reason: 'transport_paused' }
      };
    }
    if (persistedSnapshot?.deliveryPolicy?.allowProviderWrite === false) {
      return {
        paused: true,
        persisted: true,
        duplicate: false,
        response: {
          ok: true,
          persisted: true,
          delivered: false,
          queued: true,
          staged: true,
          reason: 'queue_only_mode',
          deliveryPolicy: { ...persistedSnapshot.deliveryPolicy }
        }
      };
    }
    return { paused: false, persisted: true, duplicate: false, response: null };
  }

  function applyDeliveryOutcome(pilot, envelope, outcome) {
    if (envelope.kind === 'boot' || outcome?.buffered || outcome?.duplicate) return;
    const memberIds = outcome?.memberIds?.length ? outcome.memberIds : [envelope.id];
    const batchId = outcome?.batchId || (outcome?.staged ? 'next' : `single-${envelope.id}`);
    const identity = {
      fingerprint: outcome?.fingerprint || outcome?.proof?.fingerprint || '',
      memberFingerprint: outcome?.memberFingerprint || outcome?.proof?.memberFingerprint || ''
    };
    if (outcome?.staged || outcome?.delivered) {
      pilot.markLedgerStaged(envelope.sessionId, memberIds, batchId, Date.now(), identity);
    }
    if (outcome?.delivered) {
      pilot.markLedgerSubmitting(envelope.sessionId, batchId);
      pilot.markLedgerProven(envelope.sessionId, batchId, {
        ...(outcome.proof || {}),
        verified: outcome.proof?.verified === true,
        batchId,
        memberIds,
        fingerprint: identity.fingerprint,
        memberFingerprint: identity.memberFingerprint
      });
    } else if (!outcome?.staged) {
      pilot.completeLedgerItem(envelope.sessionId, envelope.id, outcome);
    }
  }

  async function afterForward(envelope, outcome) {
    const pilot = await state();
    applyDeliveryOutcome(pilot, envelope, outcome);
    pilot.recordDelivery(envelope.sessionId, {
      envelopeId: envelope.id,
      seq: envelope.seq || 0,
      kind: envelope.kind,
      persisted: envelope.kind !== 'boot',
      ...outcome
    });
    await commit(envelope.sessionId, pilot);
  }

  function cancelBatchCheckpoint(sessionId) {
    return coalescedCommitLane.cancel(sessionId);
  }

  function scheduleBatchCheckpoint(sessionId) {
    return coalescedCommitLane.schedule(sessionId, 'batch_checkpoint');
  }

  async function batchEvent({ sessionId, event }) {
    const pilot = await state();
    const value = event && typeof event === 'object' ? { ...event } : {};
    const memberIds = Array.isArray(value.memberIds) ? value.memberIds.map(String) : [];
    const batchId = String(value.batchId || '');
    pilot.updateBatchState(sessionId, value);
    if (value.type === 'batch_submitting' && batchId) {
      pilot.markLedgerStaged(sessionId, memberIds, batchId, Date.now(), {
        fingerprint: value.fingerprint || value.proof?.fingerprint || '',
        memberFingerprint: value.memberFingerprint || value.proof?.memberFingerprint || ''
      });
      pilot.markLedgerSubmitting(sessionId, batchId);
    } else if ((value.type === 'batch_submitted' || value.type === 'batch_reconciled') && batchId) {
      pilot.markLedgerStaged(sessionId, memberIds, batchId, Date.now(), {
        fingerprint: value.fingerprint || value.proof?.fingerprint || '',
        memberFingerprint: value.memberFingerprint || value.proof?.memberFingerprint || ''
      });
      pilot.markLedgerSubmitting(sessionId, batchId);
      if (value.type === 'batch_reconciled' || value.proof?.verified === true) {
        pilot.markLedgerProven(sessionId, batchId, value.proof || {});
      }
    } else if (value.type === 'batch_submit_failed') {
      pilot.markLedgerFailed(sessionId, memberIds, value.reason || 'batch_submit_failed');
    }
    const persistent = shouldPersistBatchEvent(value);
    if (persistent) {
      cancelBatchCheckpoint(sessionId);
      await commit(sessionId, pilot);
    } else {
      await broadcast(sessionId, pilot);
      scheduleBatchCheckpoint(sessionId);
    }
    return { ok: true, batchId, memberIds, persisted: persistent };
  }

  async function telemetry({ sessionId, role, tabId, telemetry: value }) {
    const pilot = await state();
    const previousRole = pilot.snapshot(sessionId)?.[role] || {};
    const tab = await tabState(tabId);
    const event = value?.event;
    const telemetryState = value && typeof value === 'object' ? { ...value } : {};
    delete telemetryState.event;
    const batchCheckpoint = role === 'receiver' ? telemetryState.batchState : null;
    delete telemetryState.batchState;
    const batchChanged = batchCheckpoint
      ? pilot.restoreBatchState(sessionId, batchCheckpoint)
      : false;
    const nextRole = {
      ...previousRole,
      ...tab,
      ...telemetryState,
      connected: true,
      heartbeatAt: Date.now()
    };
    const meaningful = Boolean(event) || batchChanged || hasMeaningfulTelemetryChange(previousRole, nextRole);
    const updatedRole = pilot.updateRole(sessionId, role, nextRole);
    const refreshed = pilot.snapshot(sessionId);
    if (refreshed?.mode === 'repairing' || refreshed?.mode === 'blocked') {
      applyRecoveryTransition(pilot, sessionId, {
        type: 'checks_updated',
        checks: currentRecoveryChecks(pilot.snapshot(sessionId)),
        storageCritical: pilot.snapshot(sessionId)?.storagePressure?.level === 'critical'
      });
      applyRecoveryTransition(pilot, sessionId, { type: 'verify' });
    }
    if (event?.type === 'session_armed') {
      pilot.setContextArmed(sessionId, true);
    }
    if (event?.type === 'answer_state') {
      pilot.setAnswerState(sessionId, event);
      if (['complete', 'no_response', 'timed_out', 'cancelled'].includes(String(event.state || ''))) {
        pilot.recordAnswer(sessionId, event);
      }
    } else if (event?.type === 'answer') {
      pilot.recordAnswer(sessionId, {
        envelopeId: event.envelopeId,
        elapsedMs: event.elapsedMs,
        wordCount: event.wordCount,
        state: 'complete'
      });
    } else if (event?.type === 'answer_timeout') {
      pilot.recordAnswer(sessionId, {
        envelopeId: event.envelopeId,
        timeout: true
      });
    } else if (event?.type === 'outbox_state') {
      pilot.setSenderOutboxState(sessionId, event);
      pilot.record(sessionId, event.type, event);
      const alarmName = outboxAlarmName(sessionId);
      const dueAt = Number(event.retryIntent?.dueAt || 0);
      try {
        if (Number(event.count || 0) > 0 && dueAt > 0) {
          await chromeApi.alarms?.create?.(alarmName, { when: Math.max(Date.now() + 50, dueAt) });
        } else {
          await chromeApi.alarms?.clear?.(alarmName);
        }
      } catch {}
    } else if (event?.type) {
      pilot.record(sessionId, event.type, event);
    }
    const registry = await registryProvider();
    const sla = await evaluateDeliverySla(sessionId, registry, pilot);
    if (!meaningful && !sla.action && !sla.changed) {
      broadcastHeartbeat(sessionId, role, updatedRole);
      return { ok: true, coalesced: true };
    }
    await commit(sessionId, pilot);
    return { ok: true, coalesced: false };
  }

  async function evaluateDeliverySla(sessionId, registry, pilot) {
    const snapshot = pilot.snapshot(sessionId);
    if (snapshot?.deliveryPolicy?.active || snapshot?.deliveryPolicy?.allowProviderWrite === false) {
      const prior = snapshot.deliverySla || {};
      const decision = {
        ...prior,
        state: 'queue_only',
        reason: snapshot.deliveryPolicy?.reason || 'queue_only',
        action: '',
        nextAction: snapshot.deliveryPolicy?.resumeWhen || '',
        evaluatedAt: Date.now()
      };
      pilot.setDeliverySla(sessionId, decision);
      return { ...decision, changed: prior.state !== 'queue_only' || prior.reason !== decision.reason };
    }
    const decision = deriveDeliverySla(snapshot, Date.now());
    const previousActionAt = Number(snapshot?.deliverySla?.lastActionAt || 0);
    if (!decision.action) {
      const previous = snapshot?.deliverySla || {};
      const changed = [
        'state', 'reason', 'nextAction', 'oldestId', 'oldestAt', 'targetMs'
      ].some(key => String(previous[key] ?? '') !== String(decision[key] ?? ''));
      pilot.setDeliverySla(sessionId, {
        ...decision,
        lastAction: previous.lastAction || '',
        lastActionAt: previousActionAt,
        lastResult: previous.lastResult || null
      });
      return { ...decision, changed };
    }
    let result;
    if (decision.action === 'catch_up') {
      pilot.setMode(sessionId, 'active');
      const roles = await sendToRoles(registry, sessionId, 'resume');
      const catchUp = await reconcileSession(sessionId, { registry, pilot, commitResult: false });
      result = { ok: catchUp?.ok !== false, roles, catchUp };
    } else if (decision.action === 'check_live') {
      result = await liveCheck(sessionId, registry, pilot);
    } else {
      result = await repair(sessionId, registry, pilot, { source: 'automatic' });
    }
    const at = Date.now();
    pilot.setDeliverySla(sessionId, {
      ...decision,
      state: result?.ok === false ? 'action_failed' : 'action_started',
      lastAction: decision.action,
      lastActionAt: at,
      lastResult: { ok: result?.ok !== false, error: result?.error || '' },
      evaluatedAt: at
    }, at);
    pilot.record(sessionId, 'delivery_sla_action', {
      action: decision.action,
      oldestAgeMs: decision.oldestAgeMs,
      ok: result?.ok !== false,
      error: result?.error || ''
    }, at);
    return { ...decision, result };
  }

  async function sendRuntimeCommand(registry, sessionId, role, command, payload = {}) {
    const registration = registry.getSession(sessionId)?.[role];
    if (!registration?.tabId) return { ok: false, error: `${role}_missing` };
    const fallback = () => chromeApi.tabs.sendMessage(registration.tabId, {
      type: 'PMIA_RUNTIME_COMMAND',
      sessionId,
      command,
      payload
    });
    try {
      const response = typeof requestRole === 'function'
        ? await requestRole({
            sessionId,
            role,
            tabId: registration.tabId,
            instanceId: registration.instanceId || '',
            command,
            payload,
            fallback
          })
        : await fallback();
      return response?.ok === false
        ? { ok: false, error: response.error || 'command_rejected', response }
        : { ok: true, ...(response || {}), response };
    } catch (error) {
      try {
        const response = await fallback();
        return response?.ok === false
          ? { ok: false, error: response.error || 'command_rejected', response }
          : { ok: true, ...(response || {}), response, fallback: true };
      } catch (fallbackError) {
        return { ok: false, error: safeError(fallbackError || error) };
      }
    }
  }

  async function sendToRoles(registry, sessionId, command) {
    const [sender, receiver] = await Promise.all([
      sendRuntimeCommand(registry, sessionId, 'sender', command),
      sendRuntimeCommand(registry, sessionId, 'receiver', command)
    ]);
    return { sender, receiver };
  }

  async function activeSelfTest(sessionId, registry, pilot) {
    const dashboardConnections = Number(pilot.snapshot(sessionId)?.dashboardConnections || 0);
    const result = await runRuntimeSelfTest({
      dashboardConnections,
      async probeRole(role, nonce) {
        return sendRuntimeCommand(registry, sessionId, role, 'self_test_probe', { nonce });
      },
      async storageRoundTrip(nonce) {
        const key = `pmia_self_test:${sessionId}`;
        const value = { nonce: String(nonce), at: Date.now() };
        try {
          await storageArea.set({ [key]: value });
          const stored = await storageArea.get(key);
          await storageArea.remove(key);
          return { ok: true, matched: stored?.[key]?.nonce === value.nonce };
        } catch (error) {
          await storageArea.remove(key).catch(() => {});
          return { ok: false, error: safeError(error), matched: false };
        }
      }
    });
    pilot.setSelfTest(sessionId, result);
    pilot.record(sessionId, 'runtime_self_test', {
      ok: result.ok,
      elapsedMs: result.elapsedMs,
      senderRttMs: result.roles.sender.rttMs,
      receiverRttMs: result.roles.receiver.rttMs,
      storageRttMs: result.storage.rttMs,
      dashboardConnected: result.dashboard.connected
    });
    return result;
  }

  async function runControlPlaneDrill(sessionId, registry, pilot) {
    const session = registry.getSession(sessionId);
    const snapshot = pilot.snapshot(sessionId);
    const directProbe = async role => sendRuntimeCommand(registry, sessionId, role, 'self_test_probe', { source: 'transport_drill' });
    const fallbackProbe = async role => {
      const registration = session?.[role];
      if (!registration?.tabId) return { ok: false, error: `${role}_missing` };
      try {
        const response = await chromeApi.tabs.sendMessage(registration.tabId, {
          type: 'PMIA_RUNTIME_COMMAND', sessionId, command: 'self_test_probe', payload: { source: 'transport_drill_fallback' }
        });
        return response?.ok === false ? { ok: false, error: response.error || 'fallback_rejected' } : { ok: true, role, fallback: true };
      } catch (error) { return { ok: false, error: safeError(error) }; }
    };
    const report = await runTransportDrill({
      handshake: async () => {
        const roles = ['sender', 'receiver'].map(role => snapshot?.[role]?.transportLane || {});
        return { ok: roles.every(value => value.handshakeReady && Number(value.protocolVersion) > 0 && Number(value.epoch) > 0), roles: roles.map(value => ({ protocolVersion: value.protocolVersion || 0, epoch: value.epoch || 0, capabilityCount: value.capabilities?.length || 0 })) };
      },
      direct: async () => {
        const [sender, receiver] = await Promise.all([directProbe('sender'), directProbe('receiver')]);
        return { ok: sender.ok && receiver.ok && !sender.fallback && !receiver.fallback, senderOk: sender.ok, receiverOk: receiver.ok };
      },
      fallback: async () => {
        const [sender, receiver] = await Promise.all([fallbackProbe('sender'), fallbackProbe('receiver')]);
        return { ok: sender.ok && receiver.ok, senderOk: sender.ok, receiverOk: receiver.ok };
      },
      reconnect: async () => ({ ok: ['sender', 'receiver'].every(role => Number(snapshot?.[role]?.transportLane?.epoch || 0) > 0), epochs: { sender: snapshot?.sender?.transportLane?.epoch || 0, receiver: snapshot?.receiver?.transportLane?.epoch || 0 } }),
      selectiveNack: async () => { const feedback = deriveSequenceFeedback({ lastAcceptedSeq: 1, buffered: [{ seq: 3, envelope: { seq: 3 } }] }); return { ok: JSON.stringify(feedback.nackRanges) === '[[2,2]]', nackRanges: feedback.nackRanges }; },
      alarmAudit: async () => { const event = [...(snapshot?.timeline || [])].reverse().find(item => item.type === 'alarm_rehydration_audit'); return { ok: true, restored: Number(event?.data?.restored || 0), expected: Number(event?.data?.expected || 0) }; },
      invariantAudit: async () => ({ ok: Number(snapshot?.stateAudit?.blocked || store.audit().blocked || 0) === 0, blocked: Number(snapshot?.stateAudit?.blocked || store.audit().blocked || 0), repaired: Number(snapshot?.stateAudit?.repaired || store.audit().repaired || 0) }),
      stateCompatibility: async () => ({ ok: snapshot?.stateCompatibility?.state !== 'blocked' && !snapshot?.stateAudit?.blocked, state: snapshot?.stateCompatibility?.state || 'compatible', schemaVersion: Number(snapshot?.stateCompatibility?.schemaVersion || snapshot?.stateAudit?.schemaVersion || 0) }),
      indexAudit: async () => ({ ok: snapshot?.consistencyAudit?.repairs?.some(item => item.code === 'rebuild_ledger_index') !== true, reason: snapshot?.consistencyAudit?.reason || 'consistent' }),
      capabilityProbation: async () => ({ ok: ['sender', 'receiver'].every(role => snapshot?.[role]?.adapterCapabilityProbation?.writeSafe !== false), states: Object.fromEntries(['sender', 'receiver'].map(role => [role, snapshot?.[role]?.adapterCapabilityProbation?.state || 'unknown'])) }),
      queueOnlyPolicy: async () => ({ ok: snapshot?.deliveryPolicy?.allowPersist !== false && !(snapshot?.deliveryPolicy?.active && snapshot?.deliveryPolicy?.allowProviderWrite), active: Boolean(snapshot?.deliveryPolicy?.active), reason: snapshot?.deliveryPolicy?.reason || '' }),
      restartContinuity: async () => ({ ok: snapshot?.consistencyAudit?.ok !== false && Number(snapshot?.stateAudit?.blocked || 0) === 0, recoverySchedules: snapshot?.recoverySchedules?.length || 0, retryIntent: Boolean(snapshot?.senderOutboxState?.retryIntent?.dueAt) })
    });
    pilot.setTransportDrill(sessionId, report);
    return report;
  }
  async function submitLedgerItem(sessionId, itemId, registry, pilot) {
    const currentSnapshot = pilot.snapshot(sessionId);
    if (currentSnapshot?.deliveryPolicy?.active || currentSnapshot?.deliveryPolicy?.allowProviderWrite === false) {
      return { ok: false, queued: true, error: currentSnapshot.deliveryPolicy?.reason || 'queue_only' };
    }
    const item = currentSnapshot?.ledger?.find(candidate => candidate.id === itemId);
    if (!item) return { ok: false, error: 'ledger_item_missing' };
    if (!['persisted', 'failed'].includes(item.state)) {
      return { ok: false, error: 'ledger_item_not_actionable', state: item.state };
    }
    const transportWasPaused = pilot.snapshot(sessionId)?.mode === 'paused';
    if (transportWasPaused) {
      await sendRuntimeCommand(registry, sessionId, 'receiver', 'resume', {
        source: 'submit_selected'
      });
    }
    pilot.markLedgerItemSubmitting(sessionId, itemId);
    const route = registry.route(sessionId, item.envelope);
    const outcome = await deliverFinal(route, registry);
    if (transportWasPaused) {
      await sendRuntimeCommand(registry, sessionId, 'receiver', 'pause', {
        source: 'submit_selected'
      });
    }
    applyDeliveryOutcome(pilot, item.envelope, outcome);
    pilot.recordDelivery(sessionId, {
      envelopeId: item.envelope.id,
      seq: item.envelope.seq || 0,
      source: 'operator_inbox',
      ...outcome
    });
    return { ok: true, ...outcome };
  }

  async function liveCheck(sessionId, registry, pilot) {
    const session = registry.getSession(sessionId);
    const roles = {};
    for (const role of ['sender', 'receiver']) {
      const registration = session?.[role];
      if (!registration) {
        roles[role] = { responsive: false, error: `${role}_missing` };
        pilot.disconnectRole(sessionId, role);
        continue;
      }
      try {
        const response = await chromeApi.tabs.sendMessage(registration.tabId, {
          type: 'PMIA_PREFLIGHT_PING',
          sessionId,
          requesterRole: 'dashboard'
        });
        roles[role] = {
          responsive: response?.ok === true,
          provider: response?.provider || registration.provider,
          composerAvailable: Boolean(response?.composerAvailable),
          version: response?.version || '',
          capabilities: response?.capabilities || null
        };
        pilot.updateRole(sessionId, role, {
          provider: registration.provider,
          phase: response?.composerAvailable ? 'ready' : 'registered',
          composerReady: Boolean(response?.composerAvailable),
          adapterCapabilities: response?.capabilities || null,
          heartbeatAt: Date.now()
        });
      } catch (error) {
        roles[role] = { responsive: false, error: safeError(error) };
        pilot.updateRole(sessionId, role, {
          provider: registration.provider,
          phase: 'unresponsive',
          composerReady: false,
          heartbeatAt: Date.now()
        });
      }
    }
    const ok = Boolean(roles.sender?.responsive && roles.receiver?.responsive);
    await syncDeliveryPolicy(sessionId, registry, pilot, { force: true });
    let recovery = pilot.snapshot(sessionId)?.lastRepair || null;
    if (pilot.snapshot(sessionId)?.mode === 'repairing' || pilot.snapshot(sessionId)?.mode === 'blocked') {
      const reconciliation = ok
        ? await reconcileSession(sessionId, { registry, pilot, commitResult: false })
        : { ok: false, error: 'roles_unhealthy' };
      recovery = applyRecoveryTransition(pilot, sessionId, {
        type: 'checks_updated',
        checks: currentRecoveryChecks(pilot.snapshot(sessionId), { reconciliation: reconciliation.ok !== false }),
        storageCritical: pilot.snapshot(sessionId)?.storagePressure?.level === 'critical'
      });
      recovery = applyRecoveryTransition(pilot, sessionId, { type: 'verify' });
      if (recovery?.phase !== 'repairing' && recovery?.phase !== 'blocked') {
        await cancelRecoverySchedules(sessionId, pilot);
      }
    }
    pilot.record(sessionId, 'live_check', { ok, roles, recoveryPhase: recovery?.phase || '' });
    return { ok, roles, recovery };
  }

  async function scheduleRecoveryVerification(sessionId, pilot, attempt = 0) {
    return recoveryCoordinator.scheduleVerification(sessionId, pilot, attempt);
  }

  async function scheduleRecoveryTimeout(sessionId, pilot) {
    return recoveryCoordinator.scheduleTimeout(sessionId, pilot);
  }

  async function cancelRecoverySchedules(sessionId, pilot) {
    return recoveryCoordinator.cancelSchedules(sessionId, pilot);
  }

  async function repair(sessionId, registry, pilot, { source = 'automatic' } = {}) {
    const snapshot = pilot.snapshot(sessionId);
    const rootCause = classifyRuntimeRootCause({ ...snapshot, stateAudit: store.audit() }, Date.now());
    const availableBudget = snapshot?.recoveryBudget || { remaining: 1, maxAutomatic: 1 };
    let selected = selectRecoveryAction(rootCause, {
      budget: source === 'manual'
        ? { ...availableBudget, remaining: Math.max(1, Number(availableBudget.remaining || 0)) }
        : availableBudget,
      attempts: source === 'manual' ? 0 : Number(snapshot?.lastRepair?.attempt || 0),
      roleHealth: { activeAnswer: ['waiting', 'streaming'].includes(String(snapshot?.answerState?.state || '')) }
    });
    if (source === 'manual' && selected.action === 'none') {
      selected = { action: 'reconcile', reason: 'manual_verification', owner: 'operator', destructive: false };
    }
    const deliveryPolicy = deriveQueueOnlyPolicy(snapshot || {}, rootCause);
    pilot.setDeliveryPolicy(sessionId, deliveryPolicy);

    if (selected.action === 'none') {
      return { ok: true, action: 'none', reason: selected.reason, rootCause, deliveryPolicy };
    }
    if (selected.action === 'operator_handoff' || selected.action === 'queue_only') {
      const report = {
        ok: selected.action === 'queue_only',
        actions: selected.action === 'queue_only' ? [{ action: 'queue_only' }] : [],
        unresolved: selected.action === 'operator_handoff' ? [{ reason: selected.reason }] : [],
        selectedAction: selected,
        rootCause,
        deliveryPolicy,
        pendingVerification: false,
        verified: false
      };
      persistRepairReport(pilot, sessionId, report);
      return report;
    }

    const budget = pilot.consumeRecoveryBudget(sessionId, { source });
    if (!budget.accepted) return { ok: false, error: budget.reason, recoveryBudget: budget.budget, rootCause, selectedAction: selected };
    applyRecoveryTransition(pilot, sessionId, { type: 'repair_requested' });
    const report = { ok: true, actions: [], unresolved: [], selectedAction: selected, rootCause, deliveryPolicy };
    const session = registry.getSession(sessionId);
    const targetRole = String(rootCause?.evidence?.role || '');
    const roles = ['sender', 'receiver'].filter(role => !targetRole || role === targetRole);

    if (selected.action === 'reconcile') {
      const result = await reconcileSession(sessionId, { registry, pilot, commitResult: false });
      if (result?.ok === false) {
        report.ok = false;
        report.unresolved.push({ reason: result.error || 'reconciliation_failed' });
      } else {
        report.actions.push({ action: 'reconciled', role: targetRole || 'receiver' });
      }
    } else if (selected.action === 'reconnect' || selected.action === 're_register') {
      for (const role of roles) {
        const result = await sendRuntimeCommand(registry, sessionId, role, 'recover', { reason: selected.reason });
        if (result.ok) report.actions.push({ role, action: selected.action });
        else {
          report.ok = false;
          report.unresolved.push({ role, reason: result.error || `${selected.action}_failed` });
        }
      }
    } else if (selected.action === 'managed_reload') {
      for (const role of roles) {
        const registration = session?.[role];
        if (registration?.tabId) {
          try {
            await chromeApi.tabs.reload(registration.tabId);
            report.actions.push({ role, action: 'tab_reloaded' });
            continue;
          } catch {}
        }
        const roleState = snapshot?.[role] || {};
        const url = runtimeUrl(roleState.pageUrl, sessionId, role, roleState.provider);
        if (!url) {
          report.ok = false;
          report.unresolved.push({ role, reason: 'missing_repair_url' });
          continue;
        }
        try {
          await chromeApi.windows.create({
            url,
            type: 'popup',
            focused: false,
            width: role === 'sender' ? 480 : 976,
            height: 1032,
            left: role === 'sender' ? 0 : 464,
            top: 0
          });
          report.actions.push({ role, action: 'role_window_reopened' });
        } catch (error) {
          report.ok = false;
          report.unresolved.push({ role, reason: safeError(error) });
        }
      }
    }

    let finalReport = applyRecoveryTransition(pilot, sessionId, {
      type: 'checks_updated',
      checks: currentRecoveryChecks(pilot.snapshot(sessionId)),
      storageCritical: pilot.snapshot(sessionId)?.storagePressure?.level === 'critical'
    });
    finalReport = { ...finalReport, ...report, pendingVerification: report.actions.length > 0, verified: false };
    finalReport = persistRepairReport(pilot, sessionId, finalReport);
    if (!report.ok || !report.actions.length) {
      finalReport = applyRecoveryTransition(pilot, sessionId, {
        type: 'failure', error: report.unresolved[0]?.reason || 'repair_not_started'
      });
    } else {
      await scheduleRecoveryVerification(sessionId, pilot, 0);
      await scheduleRecoveryTimeout(sessionId, pilot);
    }
    return finalReport;
  }

  async function handleRecoveryAlarm(alarm) {
    const current = await state();
    const inspected = recoveryCoordinator.inspectAlarm(current, alarm);
    if (inspected.reason === 'unrelated_alarm') return { ok: false, ignored: true, error: 'unrelated_alarm' };
    if (inspected.reason === 'stale_alarm') return { ok: true, ignored: true, reason: 'stale_alarm' };
    const identity = inspected.identity;
    const snapshot = inspected.snapshot;
    if (!['repairing', 'blocked'].includes(snapshot?.lastRepair?.phase)) {
      await commit(identity.sessionId, current);
      return { ok: true, ignored: true, reason: 'recovery_complete' };
    }
    if (identity.kind === 'timeout') {
      applyRecoveryTransition(current, identity.sessionId, { type: 'timeout', error: 'verification_timeout' });
      await cancelRecoverySchedules(identity.sessionId, current);
      await commit(identity.sessionId, current);
      return { ok: true, timedOut: true };
    }
    const registry = await registryProvider();
    await liveCheck(identity.sessionId, registry, current);
    if (current.snapshot(identity.sessionId)?.lastRepair?.phase === 'repairing') {
      await scheduleRecoveryVerification(identity.sessionId, current, identity.attempt + 1);
    }
    await commit(identity.sessionId, current);
    return { ok: true, verified: current.snapshot(identity.sessionId)?.lastRepair?.phase !== 'repairing' };
  }

  async function managedWindowIds(sessionId, registry) {
    const ids = { sender: null, receiver: null, dashboard: [] };
    const session = registry.getSession(sessionId);
    for (const role of ['sender', 'receiver']) {
      const tabId = session?.[role]?.tabId;
      if (!Number.isInteger(tabId)) continue;
      try {
        const tab = await chromeApi.tabs.get(tabId);
        ids[role] = Number.isInteger(tab?.windowId) ? tab.windowId : null;
      } catch {
        ids[role] = null;
      }
    }
    for (const entry of sessionPorts(sessionId)) {
      if (Number.isInteger(entry.windowId)) ids.dashboard.push(entry.windowId);
    }
    ids.dashboard = [...new Set(ids.dashboard)];
    return ids;
  }

  async function applyLayout(sessionId, command, registry, pilot, { pushHistory = false, focusedRole = '' } = {}) {
    const layout = getRuntimeWindowLayout(command);
    if (!layout) return { ok: false, error: 'invalid_layout' };
    const ids = await managedWindowIds(sessionId, registry);
    const updates = [];
    if (Number.isInteger(ids.sender)) {
      updates.push(chromeApi.windows.update(ids.sender, windowUpdateForBounds(layout.sender)));
    }
    if (Number.isInteger(ids.receiver)) {
      updates.push(chromeApi.windows.update(ids.receiver, windowUpdateForBounds(layout.receiver)));
    }
    for (const windowId of ids.dashboard) {
      updates.push(chromeApi.windows.update(windowId, windowUpdateForBounds(layout.dashboard)));
    }
    const outcomes = await Promise.allSettled(updates);
    const failed = outcomes.filter(item => item.status === 'rejected').length;
    pilot.setLayout(sessionId, { mode: layout.mode, hidden: false, ...(focusedRole ? { focusedRole } : {}) }, Date.now(), { pushHistory });
    return { ok: failed === 0, failed, mode: layout.mode };
  }

  function layoutCommandForMode(mode) {
    return {
      three_window: 'layout_both',
      sender_dashboard: 'layout_sender',
      receiver_dashboard: 'layout_receiver',
      dashboard_only: 'layout_dashboard'
    }[String(mode || '')] || 'layout_both';
  }

  async function focusManagedWindow(sessionId, target, action, registry, pilot, focusIntent) {
    const intent = normalizeWindowNavigationIntent({ target, action, focusIntent });
    if (!intent.target || !intent.action) return { ok: false, error: 'invalid_window_navigation_intent' };
    target = intent.target;
    action = intent.action;
    focusIntent = intent.focusIntent;
    const validation = validateFocusGesture(focusIntent, {
      sessionId,
      target,
      action,
      now: Date.now(),
      consumed: consumedFocusGestures
    });
    if (!validation.ok) return validation;
    if (consumedFocusGestures.size > 512) consumedFocusGestures.delete(consumedFocusGestures.values().next().value);
    const ids = await managedWindowIds(sessionId, registry);
    const windowFor = role => role === 'pilot' ? ids.dashboard[0] : ids[role];
    const focusRole = async role => {
      const windowId = windowFor(role);
      if (!Number.isInteger(windowId)) return { ok: false, error: 'managed_window_missing', target: role };
      await chromeApi.windows.update(windowId, { focused: true, state: 'normal' });
      return { ok: true, target: role, windowId };
    };
    if (action === 'back') {
      const previous = pilot.popLayoutHistory(sessionId);
      if (!previous.ok) return previous;
      const layoutResult = await applyLayout(sessionId, layoutCommandForMode(previous.value.mode), registry, pilot, { focusedRole: previous.value.focusedRole });
      const focusResult = previous.value.focusedRole ? await focusRole(previous.value.focusedRole) : { ok: true, target: '' };
      return { ok: layoutResult.ok && focusResult.ok, action, previous: previous.value, layoutResult, focusResult, gestureId: validation.id };
    }
    const before = pilot.snapshot(sessionId)?.layout || {};
    if (action === 'spotlight') {
      const layoutCommand = target === 'sender' ? 'layout_sender' : target === 'receiver' ? 'layout_receiver' : 'layout_dashboard';
      const layoutResult = await applyLayout(sessionId, layoutCommand, registry, pilot, { pushHistory: true, focusedRole: target });
      if (!layoutResult.ok) return { ...layoutResult, action, target };
    } else {
      pilot.setLayout(sessionId, { focusedRole: target }, Date.now(), { pushHistory: true });
    }
    const focusResult = await focusRole(target);
    pilot.record(sessionId, 'managed_window_navigation', { target, action, gestureId: validation.id, priorMode: before.mode || 'three_window' });
    return { ...focusResult, action, gestureId: validation.id };
  }

  async function setHidden(sessionId, hidden, registry, pilot) {
    const ids = await managedWindowIds(sessionId, registry);
    const windowIds = [...new Set([
      ids.sender,
      ids.receiver,
      ...ids.dashboard
    ].filter(Number.isInteger))];
    if (hidden) {
      const outcomes = await Promise.allSettled(
        windowIds.map(windowId => chromeApi.windows.update(windowId, { state: 'minimized' }))
      );
      pilot.setLayout(sessionId, { hidden: true });
      return { ok: outcomes.every(item => item.status === 'fulfilled') };
    }
    return applyLayout(
      sessionId,
      layoutCommandForMode(pilot.snapshot(sessionId)?.layout?.mode),
      registry,
      pilot
    );
  }

  async function prepareEndSession(sessionId, pilot) {
    let stored;
    try {
      const key = senderOutboxStorageKey(sessionId);
      const value = await storageArea.get(key);
      stored = value?.[key];
    } catch (error) {
      return { ok: false, blocked: true, error: 'outbox_state_unavailable', detail: safeError(error) };
    }
    const snapshot = pilot.snapshot(sessionId);
    const storedCount = Array.isArray(stored) ? stored.length : 0;
    pilot.setSenderOutboxState(sessionId, {
      ...(snapshot?.senderOutboxState || {}),
      count: storedCount
    });
    const endSnapshot = pilot.snapshot(sessionId);
    const prepared = prepareSessionEnd({ ...endSnapshot, operatorChoice: deriveOperatorChoice(endSnapshot, Date.now()) });
    pilot.setEndGuard(sessionId, prepared);
    pilot.record(sessionId, 'session_end_prepared', { counts: prepared.counts, canEnd: prepared.canEnd, expiresAt: prepared.expiresAt });
    return { ok: true, ...prepared };
  }

  async function endSession(sessionId, registry, pilot, confirmation = {}) {
    const prepared = pilot.snapshot(sessionId)?.endGuard;
    let stored;
    try {
      const key = senderOutboxStorageKey(sessionId);
      const value = await storageArea.get(key);
      stored = value?.[key];
    } catch (error) {
      return { ok:false, blocked:true, error:'outbox_state_unavailable', detail:safeError(error) };
    }
    const latestSnapshot = pilot.snapshot(sessionId);
    pilot.setSenderOutboxState(sessionId, { ...(latestSnapshot?.senderOutboxState || {}), count:Array.isArray(stored) ? stored.length : 0 });
    const currentSnapshot = pilot.snapshot(sessionId);
    const currentCounts = prepareSessionEnd({ ...currentSnapshot, operatorChoice:deriveOperatorChoice(currentSnapshot,Date.now()) }).counts;
    const validation = validateSessionEnd(prepared, {
      token: confirmation.confirmToken,
      mode: confirmation.mode,
      now: Date.now(),
      currentCounts
    });
    if (!validation.ok) return { ok: false, blocked: true, ...validation };
    if (validation.mode === 'archive_and_end') pilot.archiveAllUnresolved(sessionId);
    cancelBatchCheckpoint(sessionId);
    await cancelRecoverySchedules(sessionId, pilot);
    const session = registry.getSession(sessionId);
    const tabIds = ['sender', 'receiver']
      .map(role => session?.[role]?.tabId)
      .filter(Number.isInteger);
    for (const entry of sessionPorts(sessionId)) {
      if (Number.isInteger(entry.tabId)) tabIds.push(entry.tabId);
    }
    registry.removeSession(sessionId);
    pilot.remove(sessionId);
    snapshotCaches.delete(sessionId);
    incidentStateCache.delete(sessionId);
    await saveRegistry(registry);
    await store.save(pilot);
    await clearSessionLogs(sessionId);
    await storageArea.remove(senderOutboxStorageKey(sessionId)).catch(() => {});
    return { ok: true, closeTabIds: [...new Set(tabIds)] };
  }

  function updateLivePhase(pilot, sessionId, phase, reason = 'operator', now = Date.now()) {
    const snapshot = pilot.snapshot(sessionId, now) || {};
    const current = snapshot.liveSession || { phase: 'setup' };
    const transition = transitionSessionPhase(current, phase, now, reason);
    if (!transition.ok) return transition;
    let value = transition.value;
    if (phase === 'paused') value = pauseSessionClock(value, now);
    if (phase === 'active') value = resumeSessionClock(value, now);
    pilot.setLiveSession(sessionId, { ...value, reason }, now);
    return { ok: true, changed: transition.changed, liveSession: value };
  }

  async function handleCommand(raw) {
    const command = normalizeDashboardCommand(raw);
    if (!command) return { ok: false, error: 'invalid_dashboard_command' };
    const registry = await registryProvider();
    const pilot = await state();
    const replay = pilot.replayCommandResult(command.sessionId, command.requestId);
    if (replay) {
      await commit(command.sessionId, pilot);
      return { ...(replay.result || { ok: false, error: 'empty_command_result' }), replayed: true };
    }
    const { sessionId, payload } = command;
    const commandStartedAt = Date.now();
    pilot.ensure(sessionId);
    let result;

    switch (command.command) {
      case 'run_preflight': {
        const selfTest = await activeSelfTest(sessionId, registry, pilot);
        const live = await liveCheck(sessionId, registry, pilot);
        const snapshot = pilot.snapshot(sessionId);
        result = { ok: Boolean(selfTest?.ok && live?.ok), selfTest, live, preflight: derivePreflightWizard(snapshot) };
        break;
      }
      case 'resume_live_session': {
        const snapshot = pilot.snapshot(sessionId);
        const validation = validateResumeBoundary(snapshot, payload.phase || snapshot?.checkpoint?.phase || 'active');
        if (!validation.ok) { result = validation; break; }
        const checkpoint = snapshot.checkpoint;
        if (checkpoint) pilot.setLiveSession(sessionId, { ...snapshot.liveSession, phase: validation.phase, segment: checkpoint.segment || snapshot.liveSession?.segment });
        pilot.setMode(sessionId, 'active');
        result = { ok: true, guard: validation, roles: await sendToRoles(registry, sessionId, 'resume') };
        break;
      }
      case 'dismiss_crash_resume':
        result = pilot.dismissCrashResume(sessionId);
        break;
      case 'start_mock': {
        const snapshot = pilot.snapshot(sessionId);
        const runbook = deriveInterviewRunbook(snapshot, Date.now());
        if (!runbook.ready || snapshot.mode === 'paused') {
          result = { ok: false, error: 'runbook_incomplete', runbook };
          break;
        }
        const ready = snapshot.liveSession?.phase === 'setup'
          ? updateLivePhase(pilot, sessionId, 'ready', 'runbook_complete')
          : { ok: true };
        if (!ready.ok) { result = ready; break; }
        const startedAt = snapshot.liveSession?.startedAt || Date.now();
        pilot.setLiveSession(sessionId, {
          startedAt,
          plannedDurationMs: payload.plannedDurationMs || snapshot.liveSession?.plannedDurationMs || 0,
          lastInterviewerActivityAt: Date.now(),
          reason: 'start_mock'
        });
        const phase = updateLivePhase(pilot, sessionId, 'active', 'start_mock');
        pilot.setMode(sessionId, 'active');
        result = { ok: phase.ok, liveSession: phase.liveSession, roles: await sendToRoles(registry, sessionId, 'resume') };
        break;
      }
      case 'set_session_phase': {
        if (payload.phase === 'ended') { result = { ok: false, error: 'use_end_session' }; break; }
        result = updateLivePhase(pilot, sessionId, payload.phase, payload.reason);
        if (result.ok && payload.phase === 'paused') {
          pilot.setMode(sessionId, 'paused');
          result.roles = await sendToRoles(registry, sessionId, 'pause');
        } else if (result.ok && payload.phase === 'active') {
          pilot.setMode(sessionId, 'active');
          result.roles = await sendToRoles(registry, sessionId, 'resume');
        }
        break;
      }
      case 'mark_interviewer_activity':
        result = { ok: true, liveSession: pilot.markInterviewerActivity(sessionId) };
        break;
      case 'set_focus_mode':
        result = { ok: true, liveSession: pilot.setFocusMode(sessionId, Boolean(payload.value)) };
        break;
      case 'set_shortcut_binding':
        result = pilot.setShortcutBinding(sessionId, payload.commandId, payload.chord);
        break;
      case 'reset_shortcut_bindings':
        result = pilot.resetShortcutBindings(sessionId);
        break;
      case 'set_accessibility_preference':
        result = pilot.setAccessibilityPreference(sessionId, payload.name, payload.value);
        break;
      case 'acknowledge_incident':
        result = pilot.updateIncidentControl(sessionId, payload.incidentId, 'acknowledge');
        break;
      case 'snooze_incident':
        result = pilot.updateIncidentControl(sessionId, payload.incidentId, 'snooze', payload.durationMs);
        break;
      case 'clear_incident':
        result = pilot.updateIncidentControl(sessionId, payload.incidentId, 'clear');
        break;
      case 'set_quiet_mode':
        result = pilot.setQuietMode(sessionId, Boolean(payload.value));
        break;
      case 'pause':
        pilot.setMode(sessionId, 'paused');
        if (pilot.snapshot(sessionId)?.liveSession?.startedAt) updateLivePhase(pilot, sessionId, 'paused', 'transport_pause');
        result = { ok: true, roles: await sendToRoles(registry, sessionId, 'pause') };
        break;
      case 'resume_without_send':
        pilot.setMode(sessionId, 'active');
        if (pilot.snapshot(sessionId)?.liveSession?.startedAt) updateLivePhase(pilot, sessionId, 'active', 'transport_resume');
        result = { ok: true, roles: await sendToRoles(registry, sessionId, 'resume') };
        break;
      case 'resume_catch_up': {
        pilot.setMode(sessionId, 'active');
        if (pilot.snapshot(sessionId)?.liveSession?.startedAt) updateLivePhase(pilot, sessionId, 'active', 'catch_up');
        const roles = await sendToRoles(registry, sessionId, 'resume');
        const catchUp = await reconcileSession(sessionId, { registry, pilot, commitResult: false });
        result = { ok: catchUp?.ok !== false, reason: catchUp?.reason || 'catch_up_started', roles, catchUp };
        break;
      }
      case 'add_marker':
        result = pilot.addOperatorMarker(sessionId, {
          category: payload.category,
          targetType: payload.targetType,
          targetId: payload.targetId
        });
        break;
      case 'remove_marker':
        result = pilot.removeOperatorMarker(sessionId, payload.markerId);
        break;
      case 'resume_checkpoint': {
        const snapshot = pilot.snapshot(sessionId);
        if (!snapshot?.checkpoint) { result = { ok: false, error: 'checkpoint_missing' }; break; }
        const live = snapshot.checkpoint;
        pilot.setLiveSession(sessionId, {
          ...snapshot.liveSession,
          phase: ['setup','ready','active','paused','debrief'].includes(live.phase) ? live.phase : snapshot.liveSession?.phase,
          startedAt: live.clock?.startedAt || snapshot.liveSession?.startedAt || 0,
          pausedAt: live.clock?.pausedAt || 0,
          pausedTotalMs: live.clock?.pausedTotalMs || 0,
          segmentId: live.clock?.segmentId || snapshot.liveSession?.segmentId || ''
        });
        pilot.setMode(sessionId, live.mode === 'paused' ? 'paused' : 'active');
        const roles = await sendToRoles(registry, sessionId, live.mode === 'paused' ? 'pause' : 'resume');
        const catchUp = live.mode === 'paused' ? null : await reconcileSession(sessionId, { registry, pilot, commitResult: false });
        result = { ok: catchUp?.ok !== false, checkpointId: live.id, roles, catchUp };
        break;
      }
      case 'set_question_pin':
        result = pilot.updateQuestionMetadata(sessionId, payload.itemId, { pinned: Boolean(payload.value) }, 'pin');
        break;
      case 'defer_question':
        result = pilot.updateQuestionMetadata(sessionId, payload.itemId, { deferCondition: payload.condition, deferUntil: payload.until }, 'defer');
        break;
      case 'set_question_priority':
        result = pilot.updateQuestionMetadata(sessionId, payload.itemId, { priority: payload.priority }, 'priority');
        break;
      case 'link_question_follow_up': {
        const snapshot = pilot.snapshot(sessionId);
        const ledgerIds = new Set((snapshot?.ledger || []).map(item => item.id));
        const relationIndex = Object.fromEntries([...ledgerIds].map(id => [id, snapshot?.questionOperations?.metadata?.[id] || {}]));
        const validation = validateQuestionRelation(relationIndex, payload.itemId, payload.parentId);
        result = validation.ok
          ? pilot.updateQuestionMetadata(sessionId, payload.itemId, { parentId: validation.parentId }, 'relationship')
          : validation;
        break;
      }
      case 'undo_question_action':
        result = pilot.undoQuestionMetadata(sessionId, payload.undoId);
        break;
      case 'submit_selected':
        result = await submitLedgerItem(sessionId, payload.queueItemId, registry, pilot);
        break;
      case 'set_auto_submit':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'set_auto_submit', {
          value: Boolean(payload.value)
        });
        break;
      case 'set_hold':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'set_hold', {
          value: Boolean(payload.value)
        });
        break;
      case 'set_receiver_policy':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'set_receiver_policy', {
          policy: payload.policy || {}
        });
        break;
      case 'preview_interrupt_latest':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'preview_interrupt_latest', { source: 'dashboard' });
        break;
      case 'acknowledge_answer':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'acknowledge_answer', { source: 'dashboard' });
        break;
      case 'resolve_operator_choice': {
        const validation = validateOperatorChoice(pilot.snapshot(sessionId), payload, Date.now());
        if (!validation.ok) { result = validation; break; }
        const mapped = commandForChoice(validation.choice.type, validation.option);
        if (!mapped) { result = { ok: false, error: 'choice_command_missing' }; break; }
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', mapped.command, { source: 'dashboard_choice', ...mapped.payload });
        break;
      }
      case 'resolve_no_response':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'resolve_no_response', { action: payload.action });
        break;
      case 'submit_now':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'submit_next', {
          source: 'dashboard'
        });
        break;
      case 'interrupt_latest':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'interrupt_latest', {
          source: 'dashboard', token: String(payload.token || '')
        });
        break;
      case 'resolve_draft_keep_manual':
      case 'resolve_draft_restore_pmia':
      case 'resolve_draft_merge':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', command.command, {
          source: 'dashboard'
        });
        break;
      case 'archive_selected': {
        const archived = pilot.archiveLedgerItem(sessionId, payload.queueItemId);
        result = {
          ok: Boolean(archived),
          ledgerItemId: payload.queueItemId,
          archived: archived ? 1 : 0
        };
        break;
      }
      case 'archive_all':
        result = { ok: true, archived: pilot.archiveAllUnresolved(sessionId).length };
        break;
      case 'compact_proven': {
        const transient = pilot.compactTransientHistory(sessionId, {
          timelineRetain: 60, metricRetain: 16, commandRetain: 48
        });
        const proven = pilot.compactProvenHistory(sessionId, 20);
        result = { ok: true, transientCompacted: transient, provenCompacted: proven };
        break;
      }
      case 'archive_proven':
        result = { ok: true, archived: pilot.archiveProven(sessionId).length };
        break;
      case 'apply_operating_profile': {
        const confirmation = validatePolicyImpactConfirmation(pilot.snapshot(sessionId), payload.preview, Date.now());
        if (!confirmation.ok || confirmation.preview.kind !== 'operating_profile' || confirmation.preview.target !== payload.profile) { result = { ok: false, error: confirmation.error || 'policy_preview_mismatch', blockers: confirmation.blockers || [] }; break; }
        const preview = deriveOperatingProfile(pilot.snapshot(sessionId), payload.profile);
        if (!preview.eligibility.allowed) { result = { ok: false, error: 'profile_blocked', blockers: preview.eligibility.blockers, profile: preview.id }; break; }
        const results = [];
        results.push(await sendRuntimeCommand(registry, sessionId, 'receiver', 'set_auto_submit', { value: preview.autoSubmit }));
        results.push(await sendRuntimeCommand(registry, sessionId, 'receiver', 'set_hold', { value: preview.hold }));
        results.push(await sendRuntimeCommand(registry, sessionId, 'receiver', 'set_receiver_policy', { policy: preview.receiverPolicy }));
        const failed = results.find(value => !value?.ok);
        if (failed) { result = { ok: false, error: failed.error || 'profile_apply_failed', profile: preview.id, results }; break; }
        const controls = pilot.setOperatingProfile(sessionId, preview.id, Date.now(), 'dashboard');
        result = { ok: true, profile: preview.id, controls, results };
        break;
      }
      case 'set_containment_override': {
        const currentSnapshot = pilot.snapshot(sessionId);
        const confirmation = validatePolicyImpactConfirmation(currentSnapshot, payload.preview, Date.now());
        if (!confirmation.ok || confirmation.preview.kind !== 'containment_override' || (confirmation.preview.target === 'enable') !== Boolean(payload.enabled)) { result = { ok: false, error: confirmation.error || 'policy_preview_mismatch', blockers: confirmation.blockers || [] }; break; }
        const containment = deriveContainmentStatus(currentSnapshot, Date.now());
        if (payload.enabled && !containment.overrideEligible) { result = { ok: false, error: 'containment_override_blocked', containment }; break; }
        const controls = pilot.setContainmentOverride(sessionId, Boolean(payload.enabled), Number(payload.durationMs || 0), payload.reason || 'operator', Date.now());
        const synchronized = await syncDeliveryPolicy(sessionId, registry, pilot, { force: true });
        result = { ok: true, controls, containment: deriveContainmentStatus(pilot.snapshot(sessionId), Date.now()), synchronized };
        break;
      }
      case 'probe_transport':
        result = await activeSelfTest(sessionId, registry, pilot);
        break;
      case 'record_session_navigator_visit':
        result = { ok: true, navigator: pilot.recordSessionNavigatorVisit(sessionId, payload.visit || {}, Date.now()) };
        break;
      case 'save_navigator_workspace':
        result = pilot.upsertSessionNavigatorWorkspace(sessionId, payload.workspace || {}, Date.now());
        break;
      case 'add_navigator_bookmark':
        result = pilot.upsertSessionNavigatorBookmark(sessionId, payload.bookmark || {}, Date.now());
        break;
      case 'remove_navigator_bookmark':
        result = pilot.removeSessionNavigatorBookmark(sessionId, payload.bookmarkId, Date.now());
        break;
      case 'set_navigator_goal':
        result = pilot.upsertSessionNavigatorGoal(sessionId, payload.goal || {}, Date.now());
        break;
      case 'tag_navigator_coverage':
        result = pilot.tagSessionNavigatorCoverage(sessionId, payload.questionId, payload.goalIds || [], Date.now());
        break;
      case 'mark_navigator_scenario_complete':
        result = pilot.markSessionNavigatorScenarioComplete(sessionId, payload.scenarioId, Date.now());
        break;
      case 'record_navigator_debrief_export':
        result = { ok: true, navigator: pilot.recordSessionNavigatorDebriefExport(sessionId, Date.now()) };
        break;
      case 'record_production_navigation':
        result = { ok: true, controls: pilot.setProductionNavigation(sessionId, payload.route || {}, Date.now()) };
        break;
      case 'check_live':
        result = await liveCheck(sessionId, registry, pilot);
        break;
      case 'run_self_test':
        result = await activeSelfTest(sessionId, registry, pilot);
        break;
      case 'start_stabilization': {
        const runbook = startRunbook(pilot.snapshot(sessionId), Date.now());
        pilot.setStabilizationRunbook(sessionId, runbook);
        result = { ok: true, runbook };
        break;
      }
      case 'run_stabilization_step': {
        const current = pilot.snapshot(sessionId)?.stabilizationRunbook;
        if (!current || !current.steps?.length) { result = { ok: false, error: 'stabilization_missing' }; break; }
        const step = current.steps[current.current || 0];
        let stepResult = { ok: true };
        if (step.command === 'run_self_test') stepResult = await activeSelfTest(sessionId, registry, pilot);
        else if (step.command === 'check_live') stepResult = await liveCheck(sessionId, registry, pilot);
        else if (step.command === 'resume_catch_up') stepResult = await reconcileSession(sessionId, registry, pilot);
        else if (step.command === 'repair_runtime') stepResult = await repair(sessionId, registry, pilot, { source: 'stabilization' });
        else if (step.command === 'audit_consistency') stepResult = await auditConsistency(sessionId);
        const runbook = advanceRunbook(current, stepResult, Date.now());
        pilot.setStabilizationRunbook(sessionId, runbook);
        result = { ok: stepResult?.ok !== false, runbook, stepResult };
        break;
      }
      case 'cancel_stabilization':
        result = { ok: true, runbook: pilot.setStabilizationRunbook(sessionId, cancelRunbook(pilot.snapshot(sessionId)?.stabilizationRunbook || {}, Date.now())) };
        break;
      case 'repair_live_metadata': {
        const snapshot = pilot.snapshot(sessionId);
        const audit = auditLiveCommandIntegrity(snapshot, Date.now());
        if (!audit.repairable) { result = { ok: false, error: 'live_metadata_ambiguous', audit }; break; }
        const repaired = repairLiveCommandMetadata(snapshot, Date.now());
        result = { ...pilot.repairLiveCommandMetadata(sessionId, repaired), audit: auditLiveCommandIntegrity({ ...snapshot, questionOperations: { ...(snapshot.questionOperations || {}), metadata: repaired.metadata, undoJournal: repaired.undoJournal }, operatorMarkers: repaired.markers, incidentControls: { ...(snapshot.incidentControls || {}), controls: repaired.controls } }, Date.now()) };
        break;
      }
      case 'repair_runtime':
        result = await repair(sessionId, registry, pilot, { source: 'manual' });
        break;
      case 'reset_recovery_budget':
        result = { ok: true, recoveryBudget: pilot.resetRecoveryBudget(sessionId) };
        break;
      case 'run_transport_drill':
        result = await runControlPlaneDrill(sessionId, registry, pilot);
        break;
      case 'retry_outbox':
        result = await sendRuntimeCommand(registry, sessionId, 'sender', 'retry_outbox');
        break;
      case 'resend_context':
        result = await sendRuntimeCommand(registry, sessionId, 'sender', 'resend_context');
        break;
      case 'toggle_mic':
        result = await sendRuntimeCommand(registry, sessionId, 'sender', 'toggle_mic');
        break;
      case 'toggle_scroll':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'toggle_scroll');
        break;
      case 'focus_composer':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'focus_composer');
        break;
      case 'export_session':
        setTimeout(() => {
          exportManagedSession({
            registry,
            sessionId,
            sendToTab: (tabId, outgoing) => chromeApi.tabs.sendMessage(tabId, outgoing)
          }).catch(() => {});
        }, 0);
        result = { ok: true, scheduled: true };
        break;
      case 'export_support_bundle': {
        const currentSnapshot = await broadcast(sessionId, pilot) || pilot.snapshot(sessionId);
        result = {
          ok: true,
          bundle: buildSafeSupportBundle({
            ...currentSnapshot,
            stateAudit: store.audit(),
            rootCause: classifyRuntimeRootCause({ ...currentSnapshot, stateAudit: store.audit() }, Date.now())
          }, {
            manifest: chromeApi.runtime?.getManifest?.() || {},
            sourceHashes: {}
          })
        };
        break;
      }
      case 'prepare_end_session':
        result = await prepareEndSession(sessionId, pilot);
        break;
      case 'end_session':
        result = await endSession(sessionId, registry, pilot, payload);
        break;
      case 'focus_sender':
        result = await focusManagedWindow(sessionId, 'sender', 'focus', registry, pilot, payload.focusIntent);
        break;
      case 'focus_receiver':
        result = await focusManagedWindow(sessionId, 'receiver', 'focus', registry, pilot, payload.focusIntent);
        break;
      case 'focus_pilot':
        result = await focusManagedWindow(sessionId, 'pilot', 'focus', registry, pilot, payload.focusIntent);
        break;
      case 'spotlight_sender':
        result = await focusManagedWindow(sessionId, 'sender', 'spotlight', registry, pilot, payload.focusIntent);
        break;
      case 'spotlight_receiver':
        result = await focusManagedWindow(sessionId, 'receiver', 'spotlight', registry, pilot, payload.focusIntent);
        break;
      case 'spotlight_pilot':
        result = await focusManagedWindow(sessionId, 'pilot', 'spotlight', registry, pilot, payload.focusIntent);
        break;
      case 'focus_back':
        result = await focusManagedWindow(sessionId, 'previous', 'back', registry, pilot, payload.focusIntent);
        break;
      case 'layout_both':
      case 'layout_sender':
      case 'layout_receiver':
      case 'layout_dashboard':
        result = await applyLayout(sessionId, command.command, registry, pilot, { pushHistory: true });
        break;
      case 'hide_managed':
        result = await setHidden(sessionId, true, registry, pilot);
        break;
      case 'restore_managed':
        result = await setHidden(sessionId, false, registry, pilot);
        break;
      default:
        result = { ok: false, error: 'unsupported_dashboard_command' };
    }

    if (command.command === 'end_session') return result;
    const commandCompletedAt = Date.now();
    pilot.recordCommandResult(
      sessionId,
      command.requestId,
      command.command,
      result,
      commandStartedAt,
      commandCompletedAt
    );
    pilot.record(sessionId, 'dashboard_command', {
      command: command.command,
      ok: Boolean(result?.ok),
      error: result?.error || '',
      durationMs: Math.max(0, commandCompletedAt - commandStartedAt)
    });
    await commit(sessionId, pilot);
    return result;
  }

  function connectPort(port) {
    const sessionId = parseDashboardPortName(port.name);
    if (!sessionId) return false;
    const entry = {
      port,
      tabId: Number.isInteger(port.sender?.tab?.id) ? port.sender.tab.id : null,
      windowId: Number.isInteger(port.sender?.tab?.windowId) ? port.sender.tab.windowId : null,
      lastSnapshot: null,
      generation: 0
    };
    if (!ports.has(sessionId)) ports.set(sessionId, new Set());
    ports.get(sessionId).add(entry);

    mutationCoordinator.run(sessionId, async () => {
      const pilot = await state();
      pilot.ensure(sessionId);
      pilot.setDashboardConnections(sessionId, sessionPorts(sessionId).size);
      pilot.record(sessionId, 'dashboard_connected', {
        tabId: entry.tabId,
        windowId: entry.windowId
      });
      await commit(sessionId, pilot);
    }).catch(error => {
      const snapshot = blockedStateSnapshot(sessionId, error);
      entry.lastSnapshot = snapshot;
      entry.generation = Math.max(1, Number(entry.generation || 0) + 1);
      post(port, { type: 'PMIA_DASHBOARD_SNAPSHOT', sessionId, snapshot, generation: entry.generation });
    });

    port.onMessage.addListener(raw => {
      if (raw?.type === 'PMIA_DASHBOARD_RESYNC_REQUEST') {
        entry.lastSnapshot = null;
        entry.generation = 0;
        mutationCoordinator.run(sessionId, () => broadcast(sessionId)).catch(() => {});
        return;
      }
      mutationCoordinator.run(sessionId, () => handleCommand(raw))
        .then(result => {
          post(port, {
            type: 'PMIA_DASHBOARD_COMMAND_RESULT',
            requestId: String(raw?.requestId || ''),
            result
          });
          if (result?.closeTabIds?.length) {
            setTimeout(() => chromeApi.tabs.remove(result.closeTabIds).catch(() => {}), 80);
          }
        })
        .catch(error => {
          post(port, {
            type: 'PMIA_DASHBOARD_COMMAND_RESULT',
            requestId: String(raw?.requestId || ''),
            result: { ok: false, error: safeError(error) }
          });
        });
    });

    port.onDisconnect.addListener(() => {
      const entries = ports.get(sessionId);
      entries?.delete(entry);
      if (entries && !entries.size) ports.delete(sessionId);
      mutationCoordinator.run(sessionId, async () => {
        const pilot = await state();
        if (!pilot.snapshot(sessionId)) return;
        pilot.setDashboardConnections(sessionId, sessionPorts(sessionId).size);
        pilot.record(sessionId, 'dashboard_disconnected', { tabId: entry.tabId });
        await store.save(pilot);
      }).catch(() => {});
    });
    return true;
  }

  async function disconnectTab(tabId, affectedSessionIds = []) {
    const results = [];
    for (const sessionId of affectedSessionIds) {
      results.push(await mutationCoordinator.run(sessionId, async () => {
        const pilot = await state();
        const snapshot = pilot.snapshot(sessionId);
        for (const role of ['sender', 'receiver']) {
          if (snapshot?.[role]?.tabId === tabId) pilot.disconnectRole(sessionId, role);
        }
        await commit(sessionId, pilot);
        return sessionId;
      }));
    }
    return results;
  }

  async function removeSession(sessionId) {
    cancelBatchCheckpoint(sessionId);
    const dashboardTabIds = [...sessionPorts(sessionId)]
      .map(entry => entry.tabId)
      .filter(Number.isInteger);
    const pilot = await state();
    await cancelRecoverySchedules(sessionId, pilot);
    pilot.remove(sessionId);
    snapshotCaches.delete(sessionId);
    recoveryCoordinator.clear(sessionId);
    await store.save(pilot);
    await broadcast(sessionId, pilot);
    if (dashboardTabIds.length) {
      setTimeout(() => chromeApi.tabs.remove([...new Set(dashboardTabIds)]).catch(() => {}), 80);
    }
  }

  async function recordAlarmAudit(sessionId, data = {}) {
    const pilot = await state();
    pilot.record(sessionId, 'alarm_rehydration_audit', {
      restored: Math.max(0, Number(data.restored) || 0),
      unchanged: Math.max(0, Number(data.unchanged) || 0),
      cleared: Math.max(0, Number(data.cleared) || 0),
      expected: Math.max(0, Number(data.expected) || 0),
      auditedAt: Math.max(0, Number(data.auditedAt) || Date.now())
    });
    await commit(sessionId, pilot);
    return { ok: true };
  }
  async function recordRegistrationRecovery(sessionId, data) {
    const pilot = await state();
    pilot.record(sessionId, 'registration_recovered', data);
    await commit(sessionId, pilot);
  }

  async function auditConsistency(sessionId, { registry = null, alarms = null } = {}) {
    const pilot = await state();
    const derived = await refreshDerivedPolicies(sessionId, pilot, { registry, alarms });
    await commit(sessionId, pilot, 'consistency_audit', { skipConsistency: true });
    return derived.consistencyAudit;
  }

  async function snapshot(sessionId) {
    try {
      const pilot = await state();
      const value = pilot.snapshot(sessionId, Date.now());
      return value ? { ...value, stateAudit: store.audit() } : null;
    } catch (error) {
      return blockedStateSnapshot(sessionId, error);
    }
  }

  return {
    connectPort,
    handlePreview: input => mutationCoordinator.run(input?.preview?.sessionId, () => handlePreview(input)),
    beforeForward: envelope => mutationCoordinator.run(envelope?.sessionId, () => beforeForward(envelope)),
    afterForward: (envelope, outcome) => mutationCoordinator.run(
      envelope?.sessionId,
      () => afterForward(envelope, outcome)
    ),
    telemetry: input => mutationCoordinator.run(input?.sessionId, () => telemetry(input)),
    batchEvent: input => mutationCoordinator.run(input?.sessionId, () => batchEvent(input)),
    reconcileSession: (sessionId, options) => mutationCoordinator.run(
      sessionId,
      () => reconcileSession(sessionId, options)
    ),
    syncRegistration: registration => mutationCoordinator.run(
      registration?.sessionId,
      () => syncRegistration(registration)
    ),
    transportLane: value => mutationCoordinator.run(value?.sessionId, () => transportLane(value)),
    recordAlarmAudit: (sessionId, data) => mutationCoordinator.run(
      sessionId,
      () => recordAlarmAudit(sessionId, data)
    ),
    recordRegistrationRecovery: (sessionId, data) => mutationCoordinator.run(
      sessionId,
      () => recordRegistrationRecovery(sessionId, data)
    ),
    auditConsistency: (sessionId, options) => mutationCoordinator.run(
      sessionId,
      () => auditConsistency(sessionId, options)
    ),
    disconnectTab,
    removeSession: sessionId => mutationCoordinator.run(sessionId, () => removeSession(sessionId)),
    snapshot,
    handleAlarm: alarm => {
      const identity = recoveryCoordinator.alarmIdentity(alarm);
      if (!identity) return Promise.resolve({ ok: false, ignored: true, error: 'unrelated_alarm' });
      return mutationCoordinator.run(identity.sessionId, () => handleRecoveryAlarm(alarm));
    },
    handleCommand: raw => {
      const command = normalizeDashboardCommand(raw);
      if (!command) return Promise.resolve({ ok: false, error: 'invalid_dashboard_command' });
      return mutationCoordinator.run(command.sessionId, () => handleCommand(raw));
    },
    commit: (sessionId, pilot) => mutationCoordinator.run(sessionId, () => commit(sessionId, pilot)),
    pendingMutation: sessionId => mutationCoordinator.pending(sessionId)
  };
}
