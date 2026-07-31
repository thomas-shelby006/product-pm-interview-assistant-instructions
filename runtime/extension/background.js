import { SessionRegistry } from './shared/session-registry.js';
import { isEnvelope } from './shared/protocol.js';
import { deliverPreview } from './shared/preview.js';
import { deliverWithWakeRetry } from './shared/delivery.js';
import { createSessionLogStore } from './shared/session-log-store.js';
import { buildSessionStatus } from './shared/session-status.js';
import { runCounterpartPreflight } from './shared/preflight.js';
import { closeOwnedSessionTabs } from './shared/end-session.js';
import { exportManagedSessionForTab } from './shared/session-control.js';
import { probeRegistrationOwner } from './shared/registration-health.js';

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
let operationQueue = Promise.resolve();
let registryPromise = null;

function serialize(operation) {
  const next = operationQueue.then(operation, operation);
  operationQueue = next.catch(() => {});
  return next;
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
  try {
    await registryStorage.set({ [REGISTRY_KEY]: registry.exportState() });
  } catch (error) {
    registryPromise = null;
    throw error;
  }
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
  const outcome = await deliverWithWakeRetry({
    route,
    sendToTab: (tabId, outgoing) => chrome.tabs.sendMessage(tabId, outgoing),
    wakeTab: wakeManagedTab
  });
  if (!outcome.delivered && route?.message?.sessionId) {
    registry.queueLatest(route.message.sessionId, route.message);
    await saveRegistry(registry);
  }
  return outcome;
}

async function handleRegistration(message, tabId, registry) {
  const registration = { ...message.registration, tabId };
  let result = registry.register(
    registration,
    { now: Date.now(), staleAfterMs: STALE_AFTER_MS }
  );
  let recoveryReason = '';
  let displacedTabId = null;

  if (!result.accepted && result.conflict && result.registration) {
    const health = await probeRegistrationOwner({
      registration: result.registration,
      getTab: existingTabId => chrome.tabs.get(existingTabId),
      sendToTab: (existingTabId, outgoing) => chrome.tabs.sendMessage(existingTabId, outgoing)
    });
    if (!health.responsive) {
      displacedTabId = result.registration.tabId;
      registry.unregister(displacedTabId);
      result = registry.register(
        registration,
        { now: Date.now(), staleAfterMs: STALE_AFTER_MS }
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

  try {
    await chrome.tabs.update(tabId, { autoDiscardable: false });
  } catch {
    // Registration remains valid even if this browser cannot change discard policy.
  }

  const replacedTabId = result.replacedTabId || displacedTabId;
  if (replacedTabId) {
    chrome.tabs.sendMessage(replacedTabId, {
      type: 'PMIA_ROLE_REVOKED',
      sessionId: message.registration.sessionId,
      role: message.registration.role
    }).catch(() => {});
  }

  const pendingOutcome = result.pending
    ? await deliver({ tabId, message: result.pending }, registry)
    : null;

  if (result.changed) {
    await appendLog(
      message.registration.sessionId,
      message.registration.role,
      {
        type: recoveryReason ? 'registration_recovered' : 'registration',
        role: message.registration.role,
        provider: message.registration.provider,
        tabId,
        replacedTabId: replacedTabId || null,
        ...(recoveryReason ? { reason: recoveryReason } : {})
      }
    );
  }

  const status = await broadcastLinkStatus(
    message.registration.sessionId,
    registry
  );
  return {
    ok: true,
    changed: result.changed,
    recovered: Boolean(recoveryReason),
    pendingDelivered: Boolean(pendingOutcome?.delivered),
    pendingQueued: Boolean(pendingOutcome?.queued),
    status
  };
}

async function handleForward(message, tabId, registry) {
  if (!isEnvelope(message.envelope)) {
    return { ok: false, error: 'invalid_envelope' };
  }
  if (!registry.canForward(message.envelope.sessionId, tabId)) {
    return { ok: false, terminal: true, error: 'sender_not_registered' };
  }

  const sequence = registry.acceptSequence(
    message.envelope.sessionId,
    message.envelope.seq
  );
  if (!sequence.accepted) {
    const sequenceReason = sequence.reason === 'duplicate'
      ? 'duplicate_sequence'
      : 'stale_sequence';
    await appendLog(message.envelope.sessionId, 'sender', {
      type: 'forward_ignored',
      envelopeId: message.envelope.id,
      seq: message.envelope.seq || 0,
      reason: sequenceReason
    });
    return {
      ok: true,
      delivered: false,
      queued: false,
      reason: sequenceReason
    };
  }

  const route = registry.route(message.envelope.sessionId, message.envelope);
  await saveRegistry(registry);
  const outcome = await deliver(route, registry);
  await appendLog(message.envelope.sessionId, 'sender', {
    type: 'forward',
    envelopeId: message.envelope.id,
    kind: message.envelope.kind,
    sourceProvider: message.envelope.sourceProvider,
    delivered: outcome.delivered,
    queued: outcome.queued,
    reason: outcome.reason
  });
  await broadcastLinkStatus(message.envelope.sessionId, registry);
  return { ok: true, ...outcome };
}

function authorizeSessionMessage(registry, sessionId, tabId) {
  return Boolean(sessionId && Number.isInteger(tabId) && registry.ownsTab(sessionId, tabId));
}

function currentSessionStatus(registry, sessionId) {
  return buildSessionStatus(
    registry.getSession(sessionId),
    Date.now(),
    STALE_AFTER_MS
  );
}

async function broadcastLinkStatus(sessionId, registry) {
  const session = registry.getSession(sessionId);
  const status = currentSessionStatus(registry, sessionId);
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
      .then(registry => deliverPreview({
        registry,
        preview: message.preview,
        senderTabId: tabId,
        sendToTab: (targetTabId, outgoing) => chrome.tabs.sendMessage(targetTabId, outgoing)
      }))
      .then(sendResponse)
      .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  serialize(async () => {
    const registry = await loadRegistry();

    if (message?.type === 'PMIA_REGISTER') {
      sendResponse(await handleRegistration(message, tabId, registry));
      return;
    }

    if (message?.type === 'PMIA_FORWARD') {
      sendResponse(await handleForward(message, tabId, registry));
      return;
    }

    if (message?.type === 'PMIA_LOG_EVENT') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      const role = registry.roleForTab(message.sessionId, tabId);
      await appendLog(message.sessionId, role, message.event);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'PMIA_GET_LOG') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      const role = registry.roleForTab(message.sessionId, tabId);
      const events = await logStore.read(message.sessionId, role);
      sendResponse({ ok: true, role, events });
      return;
    }

    if (message?.type === 'PMIA_CLEAR_LOG') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      const role = registry.roleForTab(message.sessionId, tabId);
      await logStore.clearRole(message.sessionId, role);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'PMIA_RUN_PREFLIGHT') {
      sendResponse(await runCounterpartPreflight({
        registry,
        sessionId: message.sessionId,
        requesterTabId: tabId,
        sendToTab: (targetTabId, outgoing) => chrome.tabs.sendMessage(targetTabId, outgoing),
        now: Date.now(),
        staleAfterMs: STALE_AFTER_MS
      }));
      return;
    }

    if (message?.type === 'PMIA_END_SESSION') {
      const result = await closeOwnedSessionTabs({
        registry,
        sessionId: message.sessionId,
        requesterTabId: tabId,
        removeTabs: async tabIds => {
          setTimeout(() => {
            chrome.tabs.remove(tabIds).catch(() => {});
          }, 40);
        }
      });
      if (result.ok) {
        registry.removeSession(message.sessionId);
        await saveRegistry(registry);
        await logStore.clearSession(message.sessionId);
      }
      sendResponse(result);
      return;
    }

    if (message?.type === 'PMIA_GET_STATUS') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      sendResponse({
        ok: true,
        status: currentSessionStatus(registry, message.sessionId)
      });
      return;
    }
    if (message?.type === 'PMIA_DEBUG_SESSIONS') {
      sendResponse({ ok: true, sessions: registry.snapshot() });
      return;
    }

    sendResponse({ ok: false, error: 'unsupported_message' });
  }).catch(error => {
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
    await Promise.all(orphanedSessionIds.map(sessionId => logStore.clearSession(sessionId)));
    for (const sessionId of survivingSessionIds) {
      await broadcastLinkStatus(sessionId, registry);
    }
  });
});
