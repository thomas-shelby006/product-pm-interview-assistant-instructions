import { SessionRegistry } from './shared/session-registry.js';
import { isEnvelope } from './shared/protocol.js';
import { deliverPreview, routePreview } from './shared/preview.js';
import { deliverWithWakeRetry } from './shared/delivery.js';
import { createSessionLogStore } from './shared/session-log-store.js';
import { buildSessionStatus } from './shared/session-status.js';
import { runCounterpartPreflight } from './shared/preflight.js';
import { exportManagedSession, exportManagedSessionForTab } from './shared/session-control.js';
import { probeRegistrationOwner } from './shared/registration-health.js';
import { createRuntimePilotController } from './shared/runtime-pilot-controller.js';
import { shouldAllowRuntimeLeaseMigration } from './shared/registration-migration.js';
import { createRuntimePortHub } from './shared/runtime-port-hub.js';
import { createSessionMutationCoordinator } from './shared/session-mutation-coordinator.js';
import { senderOutboxStorageKey } from './shared/session-end-guard.js';

const REGISTRY_KEY = 'pmia_session_registry_v2';
const MAX_LOG_EVENTS = 500;
const STALE_AFTER_MS = 45_000;
const registryStorage = chrome.storage.session;
const logStore = createSessionLogStore({
  sessionArea: chrome.storage.session,
  legacyLocalArea: chrome.storage.local,
  maxEvents: MAX_LOG_EVENTS
});
void logStore.purgeLegacyLocalLogs().catch(() => {});
const operationCoordinator = createSessionMutationCoordinator();
const registryWriteCoordinator = createSessionMutationCoordinator();
let registryPromise = null;
let pilotController = null;
const rolePortHub = createRuntimePortHub({
  onCircuitState(value) {
    void pilotController?.transportLane(value).catch(() => {});
  },
  async onFrame(frame) {
    if (frame.operation !== 'final' || frame.identity?.role !== 'sender') {
      return { ok: false, error: 'unsupported_role_port_frame' };
    }
    return serialize(async () => {
      const registry = await loadRegistry();
      return handleForward({
        type: 'PMIA_FORWARD',
        envelope: frame.payload?.envelope,
        runtimeInstanceId: frame.identity.instanceId
      }, frame.tabId, registry);
    }, frame.identity.sessionId);
  }
});
pilotController = createRuntimePilotController({
  chromeApi: chrome,
  storageArea: chrome.storage.session,
  registryProvider: loadRegistry,
  saveRegistry,
  deliverFinal: deliver,
  exportManagedSession,
  clearSessionLogs: sessionId => logStore.clearSession(sessionId),
  async requestRole({ sessionId, role, command, payload, fallback }) {
    if (!rolePortHub.has(sessionId, role)) {
      rolePortHub.noteFallback(sessionId, role, 'role_port_missing');
      return fallback();
    }
    try {
      return await rolePortHub.request(sessionId, role, {
        operation: 'command',
        payload: { command, payload }
      }, { timeout: 500 });
    } catch {
      return fallback();
    }
  }
});

function serialize(operation, sessionId = '__background__') {
  return operationCoordinator.run(sessionId, operation);
}

async function loadRegistry() {
  if (!registryPromise) {
    registryPromise = registryStorage.get(REGISTRY_KEY)
      .then(stored => {
        return new SessionRegistry(stored[REGISTRY_KEY] || []);
      })
      .catch(error => {
        registryPromise = null;
        throw error;
      });
  }
  return registryPromise;
}

async function saveRegistry(registry) {
  return registryWriteCoordinator.run('__registry_write__', async () => {
    try {
      await registryStorage.set({ [REGISTRY_KEY]: registry.exportState() });
    } catch (error) {
      registryPromise = null;
      throw error;
    }
  });
}

async function appendLog(sessionId, role, event) {
  if (!sessionId || !role || !event) return;
  await logStore.append(sessionId, role, event);
}

async function wakeManagedTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { autoDiscardable: false });
    if (tab?.discarded) {
      await chrome.tabs.reload(tabId);
      return;
    }
    await chrome.tabs.sendMessage(tabId, { type: 'PMIA_RUNTIME_RESUME' }).catch(() => {});
  } catch {
    // The final remains queued if the managed receiver cannot be resumed in place.
  }
}

async function deliver(route, registry) {
  const startedAt = Date.now();
  let attempts = 0;
  const outcome = await deliverWithWakeRetry({
    route,
    sendToTab: (tabId, outgoing) => {
      attempts += 1;
      const sessionId = route?.message?.sessionId;
      if (sessionId && rolePortHub.has(sessionId, 'receiver')) {
        return rolePortHub.request(sessionId, 'receiver', {
          operation: 'deliver',
          payload: { envelope: outgoing.envelope }
        }, { timeout: 1200 }).catch(() => chrome.tabs.sendMessage(tabId, outgoing));
      }
      if (sessionId) rolePortHub.noteFallback(sessionId, 'receiver', 'role_port_missing');
      return chrome.tabs.sendMessage(tabId, outgoing);
    },
    wakeTab: wakeManagedTab
  });
  return {
    ...outcome,
    attempts,
    deliveryProofMs: Math.max(0, Date.now() - startedAt)
  };
}

async function handleRegistration(message, incomingTab, registry) {
  const tabId = incomingTab?.id;
  const registration = { ...message.registration, tabId };
  const existing = registry.getSession(registration.sessionId)?.[registration.role] || null;
  const allowInstanceMigration = await shouldAllowRuntimeLeaseMigration({
    existing,
    incomingTab,
    getTab: existingTabId => chrome.tabs.get(existingTabId)
  });
  let result = registry.register(
    registration,
    { now: Date.now(), staleAfterMs: STALE_AFTER_MS, allowInstanceMigration }
  );
  let recoveryReason = '';
  let displacedTabId = null;
  let displacedRegistration = null;

  if (!result.accepted && result.conflict && result.registration) {
    const health = await probeRegistrationOwner({
      registration: result.registration,
      getTab: existingTabId => chrome.tabs.get(existingTabId),
      sendToTab: (existingTabId, outgoing) => chrome.tabs.sendMessage(existingTabId, outgoing)
    });
    if (!health.responsive) {
      displacedRegistration = { ...result.registration };
      displacedTabId = result.registration.tabId;
      registry.unregister(displacedTabId);
      result = registry.register(
        registration,
        { now: Date.now(), staleAfterMs: STALE_AFTER_MS, allowInstanceMigration: true }
      );
      recoveryReason = health.reason;
    }
  }

  if (!result.accepted) {
    return {
      ok: false,
      terminal: true,
      error: 'role_conflict',
      ownerTabId: result.registration?.tabId || null
    };
  }
  await saveRegistry(registry);
  if (result.changed) {
    await pilotController.syncRegistration(result.registration);
  }

  try {
    await chrome.tabs.update(tabId, { autoDiscardable: false });
  } catch {
    // Registration remains valid even if this browser cannot change discard policy.
  }

  const replacedRegistration = result.replacedRegistration || displacedRegistration;
  const replacedTabId = replacedRegistration?.tabId || result.replacedTabId || displacedTabId;
  if (replacedTabId) {
    chrome.tabs.sendMessage(replacedTabId, {
      type: 'PMIA_ROLE_REVOKED',
      sessionId: message.registration.sessionId,
      role: message.registration.role,
      instanceId: String(replacedRegistration?.instanceId || '')
    }).catch(() => {});
  }

  if (result.changed) {
    const registrationEvent = {
      type: recoveryReason ? 'registration_recovered' : 'registration',
      role: message.registration.role,
      provider: message.registration.provider,
      tabId,
      replacedTabId: replacedTabId || null,
      ...(recoveryReason ? { reason: recoveryReason } : {})
    };
    await appendLog(
      message.registration.sessionId,
      message.registration.role,
      registrationEvent
    );
    if (recoveryReason) {
      await pilotController.recordRegistrationRecovery(
        message.registration.sessionId,
        registrationEvent
      );
    }
  }

  const status = await broadcastLinkStatus(
    message.registration.sessionId,
    registry
  );
  return {
    ok: true,
    changed: result.changed,
    recovered: Boolean(recoveryReason),
    reconciliationScheduled: message.registration.role === 'receiver',
    status
  };
}

async function handleForward(message, tabId, registry) {
  if (!isEnvelope(message.envelope)) {
    return { ok: false, persisted: false, error: 'invalid_envelope' };
  }
  if (!registry.canForward(message.envelope.sessionId, tabId, message.runtimeInstanceId)) {
    return { ok: false, persisted: false, terminal: true, error: 'sender_not_registered' };
  }

  const pilotDecision = await pilotController.beforeForward(message.envelope);
  if (pilotDecision.response) {
    await appendLog(message.envelope.sessionId, 'sender', {
      type: pilotDecision.duplicate ? 'forward_duplicate_persisted' : 'forward_persisted',
      envelopeId: message.envelope.id,
      seq: message.envelope.seq || 0,
      persisted: Boolean(pilotDecision.persisted),
      queued: Boolean(pilotDecision.response.queued),
      reason: pilotDecision.response.reason || pilotDecision.response.error || ''
    });
    await broadcastLinkStatus(message.envelope.sessionId, registry);
    return pilotDecision.response;
  }

  const route = registry.route(message.envelope.sessionId, message.envelope);
  const outcome = await deliver(route, registry);
  await pilotController.afterForward(message.envelope, outcome);
  await appendLog(message.envelope.sessionId, 'sender', {
    type: 'forward',
    envelopeId: message.envelope.id,
    kind: message.envelope.kind,
    sourceProvider: message.envelope.sourceProvider,
    persisted: Boolean(pilotDecision.persisted),
    delivered: outcome.delivered,
    queued: outcome.queued,
    reason: outcome.reason,
    attempts: outcome.attempts,
    deliveryProofMs: outcome.deliveryProofMs
  });
  await broadcastLinkStatus(message.envelope.sessionId, registry);
  return { ok: true, persisted: true, ...outcome };
}

function authorizeSessionMessage(registry, sessionId, tabId, instanceId = '') {
  return Boolean(
    sessionId && Number.isInteger(tabId) && registry.ownsTab(sessionId, tabId, instanceId)
  );
}


function currentSessionStatus(registry, sessionId) {
  return buildSessionStatus(
    registry.getSession(sessionId),
    Date.now(),
    STALE_AFTER_MS
  );
}


function validSenderOutboxState(value, sessionId) {
  return Array.isArray(value) && value.every(item => {
    const envelope = item?.envelope || item;
    return Boolean(envelope?.id && envelope?.sessionId === sessionId);
  });
}

async function broadcastLinkStatus(sessionId, registry) {
  const session = registry.getSession(sessionId);
  const status = currentSessionStatus(registry, sessionId);
  const pilot = await pilotController.snapshot(sessionId);
  status.transportMode = pilot?.mode || 'active';
  status.queueCount = pilot?.queue?.length || 0;
  const deliveries = ['sender', 'receiver']
    .map(role => session?.[role]?.tabId)
    .filter(Number.isInteger)
    .map(tabId => chrome.tabs.sendMessage(tabId, {
      type: 'PMIA_LINK_STATUS',
      sessionId,
      status
    }));
  await Promise.allSettled(deliveries);
  return status;
}


chrome.alarms.onAlarm.addListener(alarm => {
  void pilotController.handleAlarm(alarm).catch(() => {});
});

chrome.runtime.onConnect.addListener(port => {
  if (rolePortHub.connect(port)) return;
  pilotController.connectPort(port);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'export-active-pmia-session') return;
  loadRegistry()
    .then(registry => exportManagedSessionForTab({
      registry,
      tabId: tab?.id,
      sendToTab: (targetTabId, outgoing) => chrome.tabs.sendMessage(targetTabId, outgoing)
    }))
    .then(result => {
      if (!result?.ok || !result.sessionId) return;
      return appendLog(result.sessionId, 'sender', {
        type: 'control_export',
        source: 'browser_command',
        exportedTabIds: result.exportedTabIds
      });
    })
    .catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (message?.type === 'PMIA_PREVIEW') {
    loadRegistry()
      .then(registry => {
        const route = routePreview(registry, message.preview, tabId, message.runtimeInstanceId);
        if (!route.accepted) {
          return { ok: false, delivered: false, dropped: true, reason: route.reason };
        }
        return pilotController.handlePreview({
          preview: message.preview,
          deliver: () => deliverPreview({
            registry,
            preview: message.preview,
            senderTabId: tabId,
            senderInstanceId: message.runtimeInstanceId,
            sendToTab: (targetTabId, outgoing) => chrome.tabs.sendMessage(targetTabId, outgoing)
          })
        });
      })
      .then(sendResponse)
      .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  serialize(async () => {
    const registry = await loadRegistry();

    if (message?.type === 'PMIA_REGISTER') {
      sendResponse(await handleRegistration(message, sender.tab, registry));
      return;
    }

    if (message?.type === 'PMIA_FORWARD') {
      sendResponse(await handleForward(message, tabId, registry));
      return;
    }

    if (message?.type === 'PMIA_DASHBOARD_COMMAND') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId, message.runtimeInstanceId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      sendResponse(await pilotController.handleCommand(message));
      return;
    }

    if (['PMIA_SESSION_STATE_GET', 'PMIA_SESSION_STATE_SET', 'PMIA_SESSION_STATE_REMOVE'].includes(message?.type)) {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId, message.runtimeInstanceId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      const role = registry.roleForTab(message.sessionId, tabId, message.runtimeInstanceId);
      if (role !== 'sender' || message.namespace !== 'sender_outbox') {
        sendResponse({ ok: false, error: 'sender_outbox_only' });
        return;
      }
      const key = senderOutboxStorageKey(message.sessionId);
      if (message.type === 'PMIA_SESSION_STATE_GET') {
        const stored = await chrome.storage.session.get(key);
        sendResponse({ ok: true, value: stored[key] ?? null });
        return;
      }
      if (message.type === 'PMIA_SESSION_STATE_REMOVE') {
        await chrome.storage.session.remove(key);
        sendResponse({ ok: true });
        return;
      }
      if (!validSenderOutboxState(message.value, message.sessionId)) {
        sendResponse({ ok: false, error: 'invalid_sender_outbox_state' });
        return;
      }
      await chrome.storage.session.set({ [key]: message.value });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'PMIA_BATCH_EVENT') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId, message.runtimeInstanceId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      const role = registry.roleForTab(message.sessionId, tabId, message.runtimeInstanceId);
      if (role !== 'receiver') {
        sendResponse({ ok: false, error: 'receiver_only' });
        return;
      }
      sendResponse(await pilotController.batchEvent({
        sessionId: message.sessionId,
        event: message.event
      }));
      return;
    }

    if (message?.type === 'PMIA_RUNTIME_TELEMETRY') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId, message.runtimeInstanceId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      const role = registry.roleForTab(message.sessionId, tabId, message.runtimeInstanceId);
      sendResponse(await pilotController.telemetry({
        sessionId: message.sessionId,
        role,
        tabId,
        telemetry: message.telemetry
      }));
      return;
    }

    if (message?.type === 'PMIA_LOG_EVENT') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId, message.runtimeInstanceId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      const role = registry.roleForTab(message.sessionId, tabId, message.runtimeInstanceId);
      await appendLog(message.sessionId, role, message.event);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'PMIA_GET_LOG') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId, message.runtimeInstanceId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      const role = registry.roleForTab(message.sessionId, tabId, message.runtimeInstanceId);
      const events = await logStore.read(message.sessionId, role);
      sendResponse({ ok: true, role, events });
      return;
    }

    if (message?.type === 'PMIA_CLEAR_LOG') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId, message.runtimeInstanceId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      const role = registry.roleForTab(message.sessionId, tabId, message.runtimeInstanceId);
      await logStore.clearRole(message.sessionId, role);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'PMIA_RUN_PREFLIGHT') {
      sendResponse(await runCounterpartPreflight({
        registry,
        sessionId: message.sessionId,
        requesterTabId: tabId,
        requesterInstanceId: message.runtimeInstanceId,
        sendToTab: (targetTabId, outgoing) => chrome.tabs.sendMessage(targetTabId, outgoing),
        now: Date.now(),
        staleAfterMs: STALE_AFTER_MS
      }));
      return;
    }

    if (message?.type === 'PMIA_END_SESSION') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId, message.runtimeInstanceId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      const prepared = await pilotController.handleCommand({
        type: 'PMIA_DASHBOARD_COMMAND',
        sessionId: message.sessionId,
        requestId: `content-end-prepare-${tabId}-${Date.now()}`,
        command: 'prepare_end_session',
        payload: { source: 'managed_tab' }
      });
      if (!prepared?.canEnd) {
        sendResponse({ ...prepared, ok: false, blocked: true, error: 'actionable_finals_present' });
        return;
      }
      const result = await pilotController.handleCommand({
        type: 'PMIA_DASHBOARD_COMMAND',
        sessionId: message.sessionId,
        requestId: `content-end-confirm-${tabId}-${Date.now()}`,
        command: 'end_session',
        payload: { source: 'managed_tab', confirmToken: prepared.token, mode: 'clean' }
      });
      sendResponse(result);
      if (result?.closeTabIds?.length) setTimeout(() => chrome.tabs.remove(result.closeTabIds).catch(() => {}), 80);
      return;
    }

    if (message?.type === 'PMIA_GET_STATUS') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId, message.runtimeInstanceId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      sendResponse({
        ok: true,
        status: currentSessionStatus(registry, message.sessionId),
        pilot: await pilotController.snapshot(message.sessionId)
      });
      return;
    }
    if (message?.type === 'PMIA_DEBUG_SESSIONS') {
      sendResponse({ ok: true, sessions: registry.snapshot() });
      return;
    }

    sendResponse({ ok: false, error: 'unsupported_message' });
  }, message?.sessionId || message?.envelope?.sessionId || '__registry__').catch(error => {
    sendResponse({ ok: false, error: String(error?.message || error) });
  });
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const restored = changeInfo?.discarded === false || changeInfo?.frozen === false;
  if (!restored) return;
  serialize(async () => {
    const registry = await loadRegistry();
    const managed = registry.exportState().some(session => (
      session.sender?.tabId === tabId || session.receiver?.tabId === tabId
    ));
    if (!managed) return;
    try {
      await chrome.tabs.update(tabId, { autoDiscardable: false });
    } catch {
      // A waking tab may briefly reject updates; content recovery is still attempted.
    }
    chrome.tabs.sendMessage(tabId, { type: 'PMIA_RUNTIME_RESUME' }).catch(() => {});
  });
});

chrome.tabs.onRemoved.addListener(tabId => {
  serialize(async () => {
    const registry = await loadRegistry();
    const affectedSessionIds = registry.unregister(tabId);
    const orphanedSessionIds = [];
    const survivingSessionIds = [];
    for (const sessionId of affectedSessionIds) {
      const session = registry.getSession(sessionId);
      if (!session?.sender && !session?.receiver) {
        registry.removeSession(sessionId);
        orphanedSessionIds.push(sessionId);
      } else {
        survivingSessionIds.push(sessionId);
      }
    }
    await saveRegistry(registry);
    await pilotController.disconnectTab(tabId, affectedSessionIds);
    await Promise.all(orphanedSessionIds.map(async sessionId => {
      await logStore.clearSession(sessionId);
      await chrome.storage.session.remove(senderOutboxStorageKey(sessionId)).catch(() => {});
      await pilotController.removeSession(sessionId);
    }));
    for (const sessionId of survivingSessionIds) {
      await broadcastLinkStatus(sessionId, registry);
    }
  });
});
