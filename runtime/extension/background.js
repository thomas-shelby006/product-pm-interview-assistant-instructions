import { SessionRegistry } from './shared/session-registry.js';
import { isEnvelope } from './shared/protocol.js';
import { deliverPreview } from './shared/preview.js';
import { deliverWithWakeRetry } from './shared/delivery.js';
import { roleLogKey, appendBoundedLog } from './shared/session-log.js';
import { buildSessionStatus } from './shared/session-status.js';
import { runCounterpartPreflight } from './shared/preflight.js';
import { closeOwnedSessionTabs } from './shared/end-session.js';

const REGISTRY_KEY = 'pmia_session_registry_v2';
const MAX_LOG_EVENTS = 500;
const STALE_AFTER_MS = 45_000;
const registryStorage = chrome.storage.session || chrome.storage.local;
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
  const key = roleLogKey(sessionId, role);
  const stored = await chrome.storage.local.get(key);
  const events = appendBoundedLog(
    Array.isArray(stored[key]) ? stored[key] : [],
    event,
    MAX_LOG_EVENTS
  );
  await chrome.storage.local.set({ [key]: events });
}

async function wakeManagedTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true, autoDiscardable: false });
    if (Number.isInteger(tab?.windowId)) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    await chrome.tabs.sendMessage(tabId, { type: 'PMIA_RUNTIME_RESUME' }).catch(() => {});
  } catch {
    // The final remains queued if the managed receiver cannot be woken.
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
  const result = registry.register(
    { ...message.registration, tabId },
    { now: Date.now(), staleAfterMs: STALE_AFTER_MS }
  );
  await saveRegistry(registry);

  if (!result.accepted) {
    return {
      ok: false,
      terminal: true,
      error: 'role_conflict',
      ownerTabId: result.registration?.tabId || null
    };
  }

  try {
    await chrome.tabs.update(tabId, { autoDiscardable: false });
  } catch {
    // Registration remains valid even if this browser cannot change discard policy.
  }

  if (result.replacedTabId) {
    chrome.tabs.sendMessage(result.replacedTabId, {
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
      type: 'registration',
      role: message.registration.role,
      provider: message.registration.provider,
      tabId,
      replacedTabId: result.replacedTabId || null
    });
  }

  const status = await broadcastLinkStatus(
    message.registration.sessionId,
    registry
  );
  return {
    ok: true,
    changed: result.changed,
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
      const key = roleLogKey(message.sessionId, role);
      const stored = await chrome.storage.local.get(key);
      sendResponse({ ok: true, role, events: stored[key] || [] });
      return;
    }

    if (message?.type === 'PMIA_CLEAR_LOG') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      const role = registry.roleForTab(message.sessionId, tabId);
      await chrome.storage.local.remove(roleLogKey(message.sessionId, role));
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
    const affectedSessionIds = registry.exportState()
      .filter(session => (
        session.sender?.tabId === tabId ||
        session.receiver?.tabId === tabId
      ))
      .map(session => session.sessionId);
    registry.unregister(tabId);
    await saveRegistry(registry);
    for (const sessionId of affectedSessionIds) {
      await broadcastLinkStatus(sessionId, registry);
    }
  });
});
