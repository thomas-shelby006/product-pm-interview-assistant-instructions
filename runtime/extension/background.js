import { SessionRegistry } from './shared/session-registry.js';
import { isEnvelope } from './shared/protocol.js';

const registry = new SessionRegistry();
const LOG_PREFIX = 'pmia_log_';
const MAX_LOG_EVENTS = 500;

async function appendLog(sessionId, event) {
  if (!sessionId || !event) return;
  const key = `${LOG_PREFIX}${sessionId}`;
  const stored = await chrome.storage.local.get(key);
  const events = Array.isArray(stored[key]) ? stored[key] : [];
  events.push({ ...event, recordedAt: new Date().toISOString() });
  if (events.length > MAX_LOG_EVENTS) events.splice(0, events.length - MAX_LOG_EVENTS);
  await chrome.storage.local.set({ [key]: events });
}

async function deliver(route) {
  if (!route) return false;
  try {
    await chrome.tabs.sendMessage(route.tabId, {
      type: 'PMIA_DELIVER',
      envelope: route.message
    });
    return true;
  } catch (error) {
    registry.unregister(route.tabId);
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const tabId = sender.tab?.id;
    if (message?.type === 'PMIA_REGISTER') {
      const result = registry.register({ ...message.registration, tabId });
      if (result.pending) await deliver({ tabId, message: result.pending });
      await appendLog(message.registration.sessionId, {
        type: 'registration',
        role: message.registration.role,
        provider: message.registration.provider,
        tabId
      });
      sendResponse({ ok: true, pendingDelivered: Boolean(result.pending) });
      return;
    }

    if (message?.type === 'PMIA_FORWARD') {
      if (!isEnvelope(message.envelope)) {
        sendResponse({ ok: false, error: 'invalid_envelope' });
        return;
      }
      const route = registry.route(message.envelope.sessionId, message.envelope);
      const delivered = await deliver(route);
      await appendLog(message.envelope.sessionId, {
        type: 'forward',
        envelopeId: message.envelope.id,
        kind: message.envelope.kind,
        sourceProvider: message.envelope.sourceProvider,
        delivered
      });
      sendResponse({ ok: true, delivered, queued: !route });
      return;
    }

    if (message?.type === 'PMIA_LOG_EVENT') {
      await appendLog(message.sessionId, message.event);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'PMIA_GET_LOG') {
      const key = `${LOG_PREFIX}${message.sessionId}`;
      const stored = await chrome.storage.local.get(key);
      sendResponse({ ok: true, events: stored[key] || [] });
      return;
    }

    if (message?.type === 'PMIA_CLEAR_LOG') {
      await chrome.storage.local.remove(`${LOG_PREFIX}${message.sessionId}`);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'PMIA_DEBUG_SESSIONS') {
      sendResponse({ ok: true, sessions: registry.snapshot() });
      return;
    }

    sendResponse({ ok: false, error: 'unsupported_message' });
  })().catch(error => {
    sendResponse({ ok: false, error: String(error?.message || error) });
  });
  return true;
});

chrome.tabs.onRemoved.addListener(tabId => registry.unregister(tabId));
