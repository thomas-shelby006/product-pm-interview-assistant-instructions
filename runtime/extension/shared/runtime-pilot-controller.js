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
import { outboxAlarmName } from './alarm-rehydration.js';

import { classifyRegistration } from './registration-heartbeat.js';

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
  const previewTimers = new Map();
  const recoveryCoordinator = createRuntimeRecoveryCoordinator({ chromeApi });
  const batchCommitTimers = new Map();
  const mutationCoordinator = createSessionMutationCoordinator();

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

  async function state() {
    return store.load();
  }

  async function broadcast(sessionId, pilot = null) {
    const current = pilot || await state();
    const snapshot = current.snapshot(sessionId, Date.now());
    for (const entry of sessionPorts(sessionId)) {
      if (!snapshot) {
        if (post(entry.port, { type: 'PMIA_DASHBOARD_SESSION_ENDED', sessionId, snapshot: null })) {
          entry.lastSnapshot = null;
        }
        continue;
      }
      if (!entry.lastSnapshot) {
        if (post(entry.port, { type: 'PMIA_DASHBOARD_SNAPSHOT', sessionId, snapshot })) {
          entry.lastSnapshot = snapshot;
        }
        continue;
      }
      const delta = buildSnapshotDelta(entry.lastSnapshot, snapshot);
      if (delta.empty) continue;
      if (post(entry.port, { type: 'PMIA_DASHBOARD_DELTA', sessionId, delta })) {
        entry.lastSnapshot = snapshot;
      }
    }
    return snapshot;
  }

  async function commit(sessionId, pilot = null) {
    const current = pilot || await state();
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
    clearTimeout(previewTimers.get(sessionId));
    previewTimers.set(sessionId, setTimeout(() => {
      previewTimers.delete(sessionId);
      mutationCoordinator.run(sessionId, () => commit(sessionId)).catch(() => {});
    }, 140));
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
      registrationHeartbeatCount: heartbeatCount
    });
    if (classification === 'heartbeat') {
      return { ok: true, classification, persisted: false };
    }
    pilot.record(registration.sessionId, `registration_${classification}`, {
      role: registration.role,
      provider: registration.provider,
      tabId: registration.tabId,
      instanceId: String(registration.instanceId || '')
    });
    await commit(registration.sessionId, pilot);
    if (registration.role === 'receiver') {
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
    if (pilot.snapshot(envelope.sessionId)?.mode === 'paused') {
      return {
        paused: true,
        persisted: true,
        duplicate: false,
        response: { ok: true, persisted: true, delivered: false, queued: true, reason: 'transport_paused' }
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
    const timer = batchCommitTimers.get(sessionId);
    if (!timer) return false;
    clearTimeout(timer);
    batchCommitTimers.delete(sessionId);
    return true;
  }

  function scheduleBatchCheckpoint(sessionId) {
    cancelBatchCheckpoint(sessionId);
    const timer = setTimeout(() => {
      batchCommitTimers.delete(sessionId);
      void mutationCoordinator.run(sessionId, async () => {
        const pilot = await state();
        if (!pilot.snapshot(sessionId)) return;
        await commit(sessionId, pilot);
      });
    }, 60);
    batchCommitTimers.set(sessionId, timer);
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
      result = await repair(sessionId, registry, pilot);
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

  async function submitLedgerItem(sessionId, itemId, registry, pilot) {
    const item = pilot.snapshot(sessionId)?.ledger?.find(candidate => candidate.id === itemId);
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

  async function repair(sessionId, registry, pilot) {
    applyRecoveryTransition(pilot, sessionId, { type: 'repair_requested' });
    const report = { ok: true, actions: [], unresolved: [] };
    const session = registry.getSession(sessionId);
    const snapshot = pilot.snapshot(sessionId);

    for (const role of ['sender', 'receiver']) {
      const registration = session?.[role];
      if (registration?.tabId) {
        const recovered = await sendRuntimeCommand(registry, sessionId, role, 'recover');
        if (recovered.ok) {
          report.actions.push({ role, action: 'runtime_recovery_requested' });
          continue;
        }
        try {
          await chromeApi.tabs.reload(registration.tabId);
          report.actions.push({ role, action: 'tab_reloaded' });
          continue;
        } catch {
          report.unresolved.push({ role, reason: 'registered_tab_unreachable' });
          report.ok = false;
          continue;
        }
      }

      const roleState = snapshot?.[role] || {};
      const url = runtimeUrl(roleState.pageUrl, sessionId, role, roleState.provider);
      if (!url) {
        report.unresolved.push({ role, reason: 'missing_repair_url' });
        report.ok = false;
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
        report.unresolved.push({ role, reason: safeError(error) });
        report.ok = false;
      }
    }

    let finalReport = applyRecoveryTransition(pilot, sessionId, {
      type: 'checks_updated',
      checks: currentRecoveryChecks(pilot.snapshot(sessionId)),
      storageCritical: pilot.snapshot(sessionId)?.storagePressure?.level === 'critical'
    });
    finalReport = { ...finalReport, ...report, pendingVerification: true, verified: false };
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

  async function applyLayout(sessionId, command, registry, pilot) {
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
    pilot.setLayout(sessionId, { mode: layout.mode, hidden: false });
    return { ok: failed === 0, failed, mode: layout.mode };
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
    const modeToCommand = {
      three_window: 'layout_both',
      sender_dashboard: 'layout_sender',
      receiver_dashboard: 'layout_receiver',
      dashboard_only: 'layout_dashboard'
    };
    return applyLayout(
      sessionId,
      modeToCommand[pilot.snapshot(sessionId)?.layout?.mode] || 'layout_both',
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
    const prepared = prepareSessionEnd(pilot.snapshot(sessionId));
    pilot.setEndGuard(sessionId, prepared);
    pilot.record(sessionId, 'session_end_prepared', { counts: prepared.counts, canEnd: prepared.canEnd, expiresAt: prepared.expiresAt });
    return { ok: true, ...prepared };
  }

  async function endSession(sessionId, registry, pilot, confirmation = {}) {
    const prepared = pilot.snapshot(sessionId)?.endGuard;
    const validation = validateSessionEnd(prepared, {
      token: confirmation.confirmToken,
      mode: confirmation.mode,
      now: Date.now()
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
    await saveRegistry(registry);
    await store.save(pilot);
    await clearSessionLogs(sessionId);
    await storageArea.remove(senderOutboxStorageKey(sessionId)).catch(() => {});
    return { ok: true, closeTabIds: [...new Set(tabIds)] };
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
      case 'pause':
        pilot.setMode(sessionId, 'paused');
        result = { ok: true, roles: await sendToRoles(registry, sessionId, 'pause') };
        break;
      case 'resume_without_send':
        pilot.setMode(sessionId, 'active');
        result = { ok: true, roles: await sendToRoles(registry, sessionId, 'resume') };
        break;
      case 'resume_catch_up': {
        pilot.setMode(sessionId, 'active');
        const roles = await sendToRoles(registry, sessionId, 'resume');
        const catchUp = await reconcileSession(sessionId, { registry, pilot, commitResult: false });
        result = { ok: catchUp?.ok !== false, reason: catchUp?.reason || 'catch_up_started', roles, catchUp };
        break;
      }
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
      case 'submit_now':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'submit_next', {
          source: 'dashboard'
        });
        break;
      case 'interrupt_latest':
        result = await sendRuntimeCommand(registry, sessionId, 'receiver', 'interrupt_latest', {
          source: 'dashboard'
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
      case 'check_live':
        result = await liveCheck(sessionId, registry, pilot);
        break;
      case 'run_self_test':
        result = await activeSelfTest(sessionId, registry, pilot);
        break;
      case 'repair_runtime':
        result = await repair(sessionId, registry, pilot);
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
      case 'prepare_end_session':
        result = await prepareEndSession(sessionId, pilot);
        break;
      case 'end_session':
        result = await endSession(sessionId, registry, pilot, payload);
        break;
      case 'layout_both':
      case 'layout_sender':
      case 'layout_receiver':
      case 'layout_dashboard':
        result = await applyLayout(sessionId, command.command, registry, pilot);
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
      lastSnapshot: null
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
    }).catch(() => {});

    port.onMessage.addListener(raw => {
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

  async function snapshot(sessionId) {
    const pilot = await state();
    return pilot.snapshot(sessionId, Date.now());
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
