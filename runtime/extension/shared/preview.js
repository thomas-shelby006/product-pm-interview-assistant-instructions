import { PROVIDERS } from './protocol.js';
import { sanitizeTranscriptCandidate } from './transcript-filter.js';

export function makePreview({
  sessionId,
  sourceProvider,
  text,
  turnKey,
  revision,
  seq = 0,
  streamId,
  phase = 'interim',
  now = Date.now()
}) {
  const normalizedPhase = String(phase ?? '').trim() || 'interim';
  const normalizedText = normalizedPhase === 'clear' ? '' : sanitizeTranscriptCandidate(text);
  const normalizedTurnKey = String(turnKey ?? '').trim();
  const normalizedStreamId = String(streamId ?? '').trim();
  const hasStreamId = streamId !== undefined;
  const permitsEmptyText = normalizedPhase === 'clear';
  if (!sessionId || !PROVIDERS.has(sourceProvider) || (!normalizedText && !permitsEmptyText) ||
      !normalizedTurnKey || !Number.isSafeInteger(revision) || revision < 1 ||
      !Number.isSafeInteger(seq) || seq < 0 || (hasStreamId && !normalizedStreamId)) {
    throw new TypeError('Invalid PMIA preview input');
  }
  return {
    sessionId,
    sourceProvider,
    text: normalizedText,
    turnKey: normalizedTurnKey,
    revision,
    phase: normalizedPhase,
    ...(seq > 0 ? { seq } : {}),
    ...(normalizedStreamId ? { streamId: normalizedStreamId } : {}),
    createdAt: now
  };
}

export function isPreview(value) {
  return Boolean(value && typeof value === 'object' && value.sessionId &&
    PROVIDERS.has(value.sourceProvider) && typeof value.text === 'string' &&
    (value.text.trim() || value.phase === 'clear') &&
    typeof value.turnKey === 'string' && value.turnKey.trim() &&
    Number.isSafeInteger(value.revision) && value.revision > 0 &&
    (value.streamId === undefined || (typeof value.streamId === 'string' && value.streamId.trim())) &&
    (value.seq === undefined || (Number.isSafeInteger(value.seq) && value.seq > 0)));
}

export function routePreview(registry, preview, senderTabId, senderInstanceId = '') {
  if (!isPreview(preview)) {
    return { accepted: false, tabId: null, reason: 'invalid_preview' };
  }
  if (!registry?.canForward?.(preview.sessionId, senderTabId, senderInstanceId)) {
    return { accepted: false, tabId: null, reason: 'sender_not_registered' };
  }
  const receiver = registry.getSession?.(preview.sessionId)?.receiver || null;
  if (!receiver) {
    return { accepted: true, tabId: null, reason: 'receiver_absent' };
  }
  return { accepted: true, tabId: receiver.tabId, reason: 'receiver_ready' };
}

export async function deliverPreview({ registry, preview, senderTabId, senderInstanceId = '', sendToTab }) {
  const phase = String(preview?.phase || 'interim');
  const text = phase === 'clear' ? '' : sanitizeTranscriptCandidate(preview?.text);
  if (phase !== 'clear' && !text) {
    return { ok: true, delivered: false, dropped: true, reason: 'transient_preview' };
  }
  const sanitizedPreview = { ...preview, text };
  const route = routePreview(registry, sanitizedPreview, senderTabId, senderInstanceId);
  if (!route.accepted) {
    return { ok: false, delivered: false, dropped: true, reason: route.reason };
  }
  if (!route.tabId) {
    return { ok: true, delivered: false, dropped: true, reason: route.reason };
  }
  try {
    const response = await sendToTab(route.tabId, {
      type: 'PMIA_PREVIEW_DELIVER',
      preview: sanitizedPreview
    });
    if (response?.ok === false) {
      return { ok: true, delivered: false, dropped: true, reason: 'receiver_rejected' };
    }
    return { ok: true, delivered: true, dropped: false, reason: 'delivered' };
  } catch {
    return { ok: true, delivered: false, dropped: true, reason: 'receiver_unreachable' };
  }
}
