import { normalizeDashboardCommand, parseDashboardPortName } from './dashboard-protocol.js';
import { createRuntimePilotStore } from './runtime-pilot-store.js';
import { getRuntimeWindowLayout, windowUpdateForBounds } from './window-layout.js';

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
  serializeOperation = operation => operation()
} = {}) {
  const store = createRuntimePilotStore({ storageArea });
  const ports = new Map();
  const previewTimers = new Map();

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
    return broadcast(sessionId, current);
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
    pilot.recordFinal(envelope.sessionId, envelope);
    if (pilot.snapshot(envelope.sessionId)?.mode === 'paused' && envelope.kind !== 'boot') {
      const queued = pilot.queueFinal(envelope.sessionId, envelope, {
        reason: 'transport_paused'
      });
      await commit(envelope.sessionId, pilot);
      return {
        paused: true,
        response: {
          ok: true,
          delivered: false,
          queued: queued.accepted,
          reason: 'transport_paused'
        }
      };
    }
    await commit(envelope.sessionId, pilot);
    return { paused: false, response: null };
  }

  async function afterForward(envelope, outcome) {
    const pilot = await state();
    if (outcome?.queued && envelope.kind !== 'boot') {
      pilot.queueFinal(envelope.sessionId, envelope, { reason: outcome.reason });
    } else if (outcome?.delivered) {
      const completed = pilot.completeQueueSend(envelope.sessionId, envelope.id, outcome);
      if (!completed) pilot.supersedeQueuedBefore(envelope.sessionId, envelope.seq);
    }
    pilot.recordDelivery(envelope.sessionId, {
      envelopeId: envelope.id,
      seq: envelope.seq || 0,
      kind: envelope.kind,
      ...outcome
    });
    await commit(envelope.sessionId, pilot);
  }

  async function telemetry({ sessionId, role, tabId, telemetry: value }) {
    const pilot = await state();
    const tab = await tabState(tabId);
    const event = value?.event;
    const telemetryState = value && typeof value === 'object' ? { ...value } : {};
    delete telemetryState.event;
    pilot.updateRole(sessionId, role, {
      ...tab,
      ...telemetryState,
      heartbeatAt: Date.now()
    });
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
    await commit(sessionId, pilot);
    return { ok: true };
  }

  async function sendRuntimeCommand(registry, sessionId, role, command, payload = {}) {
    const registration = registry.getSession(sessionId)?.[role];
    if (!registration?.tabId) return { ok: false, error: `${role}_missing` };
    try {
      const response = await chromeApi.tabs.sendMessage(registration.tabId, {
        type: 'PMIA_RUNTIME_COMMAND',
        sessionId,
        command,
        payload
      });
      return response?.ok === false
        ? { ok: false, error: response.error || 'command_rejected', response }
        : { ok: true, response };
    } catch (error) {
      return { ok: false, error: safeError(error) };
    }
  }

  async function sendToRoles(registry, sessionId, command) {
    const [sender, receiver] = await Promise.all([
      sendRuntimeCommand(registry, sessionId, 'sender', command),
      sendRuntimeCommand(registry, sessionId, 'receiver', command)
    ]);
    return { sender, receiver };
  }

  async function sendQueuedItem(sessionId, itemId, registry, pilot) {
    const item = pilot.snapshot(sessionId)?.queue?.find(candidate => candidate.id === itemId);
    if (!item) return { ok: false, error: 'queue_item_missing' };
    if (item.status === 'superseded') {
      return { ok: false, error: 'queue_item_superseded' };
    }
    const transportWasPaused = pilot.snapshot(sessionId)?.mode === 'paused';
    if (transportWasPaused) {
      await sendRuntimeCommand(registry, sessionId, 'receiver', 'resume', {
        source: 'send_selected'
      });
    }
    pilot.markQueueSending(sessionId, itemId);
    const route = registry.route(sessionId, item.envelope);
    await saveRegistry(registry);
    const outcome = await deliverFinal(route, registry);
    if (transportWasPaused) {
      await sendRuntimeCommand(registry, sessionId, 'receiver', 'pause', {
        source: 'send_selected'
      });
    }
    pilot.completeQueueSend(sessionId, itemId, outcome);
    pilot.recordDelivery(sessionId, {
      envelopeId: item.envelope.id,
      seq: item.envelope.seq || 0,
      source: 'operator_queue',
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
          version: response?.version || ''
        };
        pilot.updateRole(sessionId, role, {
          provider: registration.provider,
          phase: response?.composerAvailable ? 'ready' : 'registered',
          composerReady: Boolean(response?.composerAvailable),
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

    pilot.setRepair(sessionId, report);
    pilot.setMode(sessionId, report.ok ? 'active' : 'degraded');
    return report;
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
      case 'resume_latest': {
        pilot.setMode(sessionId, 'active');
        const roles = await sendToRoles(registry, sessionId, 'resume');
        const queue = pilot.snapshot(sessionId)?.queue || [];
        const latest = [...queue].reverse().find(item => item.status !== 'superseded') || null;
        result = latest
          ? { ...(await sendQueuedItem(sessionId, latest.id, registry, pilot)), roles }
          : { ok: true, reason: 'queue_empty', roles };
        break;
      }
      case 'send_selected':
        result = await sendQueuedItem(sessionId, payload.queueItemId, registry, pilot);
        break;
      case 'discard_selected':
        result = {
          ok: Boolean(pilot.discardQueueItem(sessionId, payload.queueItemId)),
          queueItemId: payload.queueItemId
        };
        break;
      case 'discard_all':
        result = { ok: true, discarded: pilot.clearQueue(sessionId).length };
        break;
      case 'discard_superseded':
        result = { ok: true, discarded: pilot.discardSuperseded(sessionId).length };
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
    syncRegistration,
    recordRegistrationRecovery,
    disconnectTab,
    removeSession,
    snapshot,
    handleCommand,
    commit
  };
}
