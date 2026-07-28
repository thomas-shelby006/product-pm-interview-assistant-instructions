import { SessionRegistry } from './shared/session-registry.js';
import { isEnvelope } from './shared/protocol.js';
import { deliverPreview } from './shared/preview.js';
import { classifyDelivery } from './shared/delivery.js';
import { roleLogKey, appendBoundedLog } from './shared/session-log.js';
import { buildSessionStatus } from './shared/session-status.js';

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
        const registry = new SessionRegistry(stored[REGISTRY_KEY] || []);
        registry.pruneStale(Date.now(), STALE_AFTER_MS);
        return registry;
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

async function deliver(route, registry) {
  if (!route) return classifyDelivery({ route });
  try {
    const response = await chrome.tabs.sendMessage(route.tabId, {
      type: 'PMIA_DELIVER',
      envelope: route.message
    });
    const outcome = classifyDelivery({ route, response });
    if (!outcome.delivered) {
      registry.queueLatest(route.message.sessionId, route.message);
      await saveRegistry(registry);
    }
    return outcome;
  } catch (error) {
    registry.unregister(route.tabId);
    registry.queueLatest(route.message.sessionId, route.message);
    await saveRegistry(registry);
    return classifyDelivery({ route, error });
  }
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

  return {
    ok: true,
    changed: result.changed,
    pendingDelivered: Boolean(pendingOutcome?.delivered),
    pendingQueued: Boolean(pendingOutcome?.queued)
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
  return { ok: true, ...outcome };
}

function authorizeSessionMessage(registry, sessionId, tabId) {
  return Boolean(sessionId && Number.isInteger(tabId) && registry.ownsTab(sessionId, tabId));
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

    if (message?.type === 'PMIA_GET_STATUS') {
      if (!authorizeSessionMessage(registry, message.sessionId, tabId)) {
        sendResponse({ ok: false, error: 'session_not_owned' });
        return;
      }
      sendResponse({
        ok: true,
        status: buildSessionStatus(
          registry.getSession(message.sessionId),
          Date.now(),
          STALE_AFTER_MS
        )
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

chrome.tabs.onRemoved.addListener(tabId => {
  serialize(async () => {
    const registry = await loadRegistry();
    registry.unregister(tabId);
    await saveRegistry(registry);
  });
});
