import { normalizeDashboardCommand, parseDashboardPortName } from './dashboard-protocol.js';
import { createRuntimePilotStore } from './runtime-pilot-store.js';
import { getRuntimeWindowLayout, windowUpdateForBounds } from './window-layout.js';
import { hasMeaningfulTelemetryChange, heartbeatPatch } from './telemetry-coalescer.js';
import { classifyStoragePressure, DEFAULT_SESSION_QUOTA_BYTES } from './storage-pressure.js';
import { buildReconciliationPayload } from './delivery-reconciler.js';
import { shouldPersistBatchEvent } from './batch-event-policy.js';

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
  requestRole = null,
  serializeOperation = operation => operation()
} = {}) {
  const store = createRuntimePilotStore({ storageArea });
  const ports = new Map();
  const previewTimers = new Map();
  const batchCommitTimers = new Map();

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
      post(entry.port, {
        type: snapshot ? 'PMIA_DASHBOARD_SNAPSHOT' : 'PMIA_DASHBOARD_SESSION_ENDED',
        sessionId,
        snapshot
      });
    }
    return snapshot;
  }

  async function commit(sessionId, pilot = null) {
    const current = pilot || await state();
    await store.save(current);
    const bytes = await store.bytesInUse().catch(() => 0);
    const quota = Number(storageArea?.QUOTA_BYTES || DEFAULT_SESSION_QUOTA_BYTES);
    const pressure = classifyStoragePressure(bytes, quota);
    const prior = current.snapshot(sessionId)?.storagePressure;
    if (!prior || prior.level !== pressure.level || Math.abs(Number(prior.percent || 0) - pressure.percent) >= 1) {
      current.setStoragePressure(sessionId, pressure);
      if (pressure.level === 'high') current.compactProvenHistory(sessionId, 80);
      if (pressure.level === 'critical') current.compactProvenHistory(sessionId, 30);
      await store.save(current);
    }
    return broadcast(sessionId, current);
  }

  function broadcastHeartbeat(sessionId, role, roleState) {
    const patch = heartbeatPatch(roleState);
    for (const entry of sessionPorts(sessionId)) {
      post(entry.port, {
        type: 'PMIA_DASHBOARD_HEARTBEAT',
        sessionId,
        role,
        patch
      });
    }
  }

  function schedulePreviewCommit(sessionId) {
    clearTimeout(previewTimers.get(sessionId));
    previewTimers.set(sessionId, setTimeout(() => {
      previewTimers.delete(sessionId);
      commit(sessionId).catch(() => {});
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
    if (!payload.pending.length) return { ok: true, reason: 'ledger_clean' };
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
    if (commitResult) await commit(sessionId, currentPilot);
    return result;
  }

  async function syncRegistration(registration) {
    const pilot = await state();
    const tab = await tabState(registration.tabId);
    pilot.updateRole(registration.sessionId, registration.role, {
      ...tab,
      provider: registration.provider,
      phase: 'registered',
      heartbeatAt: registration.registeredAt || Date.now()
    });
    pilot.record(registration.sessionId, 'registration', {
      role: registration.role,
      provider: registration.provider,
      tabId: registration.tabId
    });
    await commit(registration.sessionId, pilot);
    if (registration.role === 'receiver') {
      setTimeout(() => { void reconcileSession(registration.sessionId); }, 0);
    }
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
    const pilot = await state();
    if (envelope.kind === 'boot') {
      pilot.recordFinal(envelope.sessionId, envelope);
      await commit(envelope.sessionId, pilot);
      return { paused: false, persisted: true, duplicate: false, response: null };
    }
    const persisted = pilot.persistFinal(envelope.sessionId, envelope);
    await commit(envelope.sessionId, pilot);
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
        response: {
          ok: true,
          persisted: true,
          delivered: false,
          queued: true,
          reason: 'transport_paused'
        }
      };
    }
    return { paused: false, persisted: true, duplicate: false, response: null };
  }

  function applyDeliveryOutcome(pilot, envelope, outcome) {
    if (envelope.kind === 'boot') return;
    const memberIds = outcome?.memberIds?.length ? outcome.memberIds : [envelope.id];
    const batchId = outcome?.batchId || (outcome?.staged ? 'next' : `single-${envelope.id}`);
    if (outcome?.staged || outcome?.delivered) {
      pilot.markLedgerStaged(envelope.sessionId, memberIds, batchId);
    }
    if (outcome?.delivered) {
      pilot.markLedgerSubmitting(envelope.sessionId, batchId);
      pilot.markLedgerProven(envelope.sessionId, batchId, outcome.proof || {
        proof: 'receiver_ack',
        verified: Boolean(outcome.proof?.verified)
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
      void serializeOperation(async () => {
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
      pilot.markLedgerStaged(sessionId, memberIds, batchId);
      pilot.markLedgerSubmitting(sessionId, batchId);
    } else if ((value.type === 'batch_submitted' || value.type === 'batch_reconciled') && batchId) {
      pilot.markLedgerStaged(sessionId, memberIds, batchId);
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
    if (
      refreshed?.mode === 'repairing'
      && refreshed.sender?.connected
      && refreshed.sender?.composerReady
      && refreshed.receiver?.connected
      && refreshed.receiver?.composerReady
    ) {
      pilot.setMode(sessionId, 'active');
      pilot.setRepair(sessionId, {
        ...(refreshed.lastRepair || {}),
        ok: true,
        pendingVerification: false,
        verified: true
      });
    }
    if (event?.type === 'answer') {
      pilot.recordAnswer(sessionId, {
        envelopeId: event.envelopeId,
        elapsedMs: event.elapsedMs,
        wordCount: event.wordCount
      });
    } else if (event?.type === 'answer_timeout') {
      pilot.recordAnswer(sessionId, {
        envelopeId: event.envelopeId,
        timeout: true
      });
    } else if (event?.type) {
      pilot.record(sessionId, event.type, event);
    }
    if (!meaningful) {
      broadcastHeartbeat(sessionId, role, updatedRole);
      return { ok: true, coalesced: true };
    }
    await commit(sessionId, pilot);
    return { ok: true, coalesced: false };
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
    if (pilot.snapshot(sessionId)?.mode === 'repairing') {
      pilot.setMode(sessionId, ok ? 'active' : 'degraded');
      pilot.setRepair(sessionId, {
        ...(pilot.snapshot(sessionId)?.lastRepair || {}),
        ok,
        pendingVerification: false,
        verified: ok,
        verification: roles
      });
    }
    pilot.record(sessionId, 'live_check', { ok, roles });
    return { ok, roles };
  }

  async function repair(sessionId, registry, pilot) {
    pilot.setMode(sessionId, 'repairing');
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

    const pendingVerification = report.ok && report.actions.length > 0;
    const finalReport = { ...report, pendingVerification, verified: false };
    pilot.setRepair(sessionId, finalReport);
    pilot.setMode(sessionId, pendingVerification ? 'repairing' : 'degraded');
    return finalReport;
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

  async function endSession(sessionId, registry, pilot) {
    cancelBatchCheckpoint(sessionId);
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
    return { ok: true, closeTabIds: [...new Set(tabIds)] };
  }

  async function handleCommand(raw) {
    const command = normalizeDashboardCommand(raw);
    if (!command) return { ok: false, error: 'invalid_dashboard_command' };
    const registry = await registryProvider();
    const pilot = await state();
    if (!pilot.markCommand(command.sessionId, command.requestId)) {
      return { ok: true, duplicate: true };
    }
    const { sessionId, payload } = command;
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
      case 'archive_proven':
        result = { ok: true, archived: pilot.archiveProven(sessionId).length };
        break;
      case 'check_live':
        result = await liveCheck(sessionId, registry, pilot);
        break;
      case 'repair_runtime':
        result = await repair(sessionId, registry, pilot);
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
      case 'end_session':
        result = await endSession(sessionId, registry, pilot);
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
    pilot.record(sessionId, 'dashboard_command', {
      command: command.command,
      ok: Boolean(result?.ok),
      error: result?.error || ''
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
      windowId: Number.isInteger(port.sender?.tab?.windowId) ? port.sender.tab.windowId : null
    };
    if (!ports.has(sessionId)) ports.set(sessionId, new Set());
    ports.get(sessionId).add(entry);

    state().then(async pilot => {
      pilot.ensure(sessionId);
      pilot.setDashboardConnections(sessionId, sessionPorts(sessionId).size);
      pilot.record(sessionId, 'dashboard_connected', {
        tabId: entry.tabId,
        windowId: entry.windowId
      });
      await commit(sessionId, pilot);
    }).catch(() => {});

    port.onMessage.addListener(raw => {
      serializeOperation(() => handleCommand(raw))
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
      state().then(async pilot => {
        if (!pilot.snapshot(sessionId)) return;
        pilot.setDashboardConnections(sessionId, sessionPorts(sessionId).size);
        pilot.record(sessionId, 'dashboard_disconnected', { tabId: entry.tabId });
        await store.save(pilot);
      }).catch(() => {});
    });
    return true;
  }

  async function disconnectTab(tabId, affectedSessionIds = []) {
    const pilot = await state();
    for (const sessionId of affectedSessionIds) {
      const snapshot = pilot.snapshot(sessionId);
      for (const role of ['sender', 'receiver']) {
        if (snapshot?.[role]?.tabId === tabId) pilot.disconnectRole(sessionId, role);
      }
      await commit(sessionId, pilot);
    }
  }

  async function removeSession(sessionId) {
    cancelBatchCheckpoint(sessionId);
    const dashboardTabIds = [...sessionPorts(sessionId)]
      .map(entry => entry.tabId)
      .filter(Number.isInteger);
    const pilot = await state();
    pilot.remove(sessionId);
    await store.save(pilot);
    await broadcast(sessionId, pilot);
    if (dashboardTabIds.length) {
      setTimeout(() => chromeApi.tabs.remove([...new Set(dashboardTabIds)]).catch(() => {}), 80);
    }
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
    handlePreview,
    beforeForward,
    afterForward,
    telemetry,
    batchEvent,
    reconcileSession,
    syncRegistration,
    recordRegistrationRecovery,
    disconnectTab,
    removeSession,
    snapshot,
    handleCommand,
    commit
  };
}
