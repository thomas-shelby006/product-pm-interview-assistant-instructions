import { sanitizeTranscriptCandidate } from '../shared/transcript-filter.js';

function yieldToProvider() {
  return new Promise(resolve => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => resolve());
      return;
    }
    globalThis.queueMicrotask(resolve);
  });
}
export function snapshotUserTurnIds(adapter) {
  if (typeof adapter.getConversationMessages !== 'function') return null;
  return new Set(
    adapter.getConversationMessages()
      .filter(message => message.role === 'user')
      .map(message => String(message.id || ''))
      .filter(Boolean)
  );
}

function normalizedTurnText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesSubmittedTurn(renderedText, submittedText, confirmationText = submittedText) {
  const rendered = normalizedTurnText(renderedText);
  const submitted = normalizedTurnText(submittedText);
  if (!rendered || !submitted) return false;
  if (rendered === submitted) return true;
  const confirmation = normalizedTurnText(confirmationText);
  return Boolean(confirmation && confirmation !== submitted && rendered.endsWith(confirmation));
}

export function hasNewSubmittedUserTurn(adapter, text, baselineUserIds, confirmationText = text) {
  if (!(baselineUserIds instanceof Set) || typeof adapter.getConversationMessages !== 'function') {
    return false;
  }
  return adapter.getConversationMessages().some(message => (
    message.role === 'user'
    && !baselineUserIds.has(String(message.id || ''))
    && matchesSubmittedTurn(message.text, text, confirmationText)
  ));
}

export function clearSubmittedComposer(adapter, text) {
  if (!(adapter.composerContains?.(text) ?? false)) return false;
  return Boolean(adapter.setComposerText?.(''));
}

export async function submitComposerWhenReady({
  adapter,
  text,
  yieldFn = yieldToProvider,
  maxChecks = 320,
  maxConfirmChecks = 640,
  maxSubmitAttempts = 2,
  baselineUserIds = snapshotUserTurnIds(adapter),
  confirmationText = text,
  isCurrent = () => true
}) {
  const normalized = String(text ?? '').trim();
  if (!normalized || !isCurrent()) return false;
  const attempts = Math.max(1, Number(maxSubmitAttempts) || 1);
  let composerWritten = false;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let submitTriggered = false;
    for (let check = 0; check <= maxChecks; check += 1) {
      if (!isCurrent()) return false;
      if (!composerWritten || !(adapter.composerContains?.(normalized) ?? false)) {
        composerWritten = Boolean(adapter.setComposerText(normalized));
      }
      const textReady = composerWritten && (adapter.composerContains?.(normalized) ?? true);
      const submitReady = textReady && (adapter.canSubmit?.() ?? true);
      if (submitReady && adapter.submit()) {
        submitTriggered = true;
        break;
      }
      if (check < maxChecks) await yieldFn();
    }
    if (!submitTriggered) return false;
    if (!(baselineUserIds instanceof Set)) return true;

    let retryAllowed = false;
    for (let check = 0; check <= maxConfirmChecks; check += 1) {
      if (!isCurrent()) return false;
      if (hasNewSubmittedUserTurn(adapter, normalized, baselineUserIds, confirmationText)) {
        clearSubmittedComposer(adapter, normalized);
        return true;
      }
      retryAllowed = attempt + 1 < attempts
        && check >= 48
        && (adapter.composerContains?.(normalized) ?? false)
        && !(adapter.isGenerating?.() ?? false);
      if (retryAllowed) break;
      if (check < maxConfirmChecks) await yieldFn();
    }
    if (!retryAllowed) return false;
  }
  return false;
}


export function createReceiverController({
  adapter,
  sleep,
  onStatus = () => {},
  stopTimeoutMs = 2500,
  stopPollMs = 75,
  yieldFn = yieldToProvider,
  maxSubmitChecks = 320,
  maxConfirmChecks = 640,
  maxPreviewTurns = 64,
  maxPreviewStreams = 8
}) {
  let latestDeliveryId = '';
  const lastPreviewSeqByStream = new Map();
  const previewRevisions = new Map();
  const submissionBaselines = new Map();
  let stagedContext = '';

  const boundedSet = (map, key, value, maxSize) => {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    while (map.size > maxSize) map.delete(map.keys().next().value);
  };

  const previewKey = (streamId, turnKey) => String(streamId) + '\u0000' + String(turnKey);
  const clearCommittedPreview = envelope => {
    const metadata = envelope?.metadata || {};
    const streamId = String(metadata.previewStreamId || 'legacy').trim() || 'legacy';
    for (const identity of [metadata.turnKey, metadata.messageId]) {
      const turnKey = String(identity || '').trim();
      if (turnKey) previewRevisions.delete(previewKey(streamId, turnKey));
    }
  };

  async function waitForIdle(deliveryId) {
    const attempts = Math.max(1, Math.ceil(stopTimeoutMs / stopPollMs));
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (deliveryId !== latestDeliveryId) return false;
      if (!adapter.isGenerating()) return true;
      await sleep(stopPollMs);
    }
    return !adapter.isGenerating();
  }

  const questionWithStagedContext = question => {
    const normalizedQuestion = String(question || '').trim();
    if (!stagedContext) return normalizedQuestion;
    return `${stagedContext}

---

LIVE INTERVIEWER QUESTION:
${normalizedQuestion}`;
  };

  return {
    hasStagedContext() {
      return Boolean(stagedContext);
    },
    preview(preview) {
      const turnKey = String(preview?.turnKey || '').trim();
      const phase = String(preview?.phase || 'interim');
      const text = phase === 'clear' ? '' : sanitizeTranscriptCandidate(preview?.text);
      const revision = Number(preview?.revision || 0);
      const seq = Number(preview?.seq || 0);
      const streamId = String(preview?.streamId || 'legacy').trim() || 'legacy';
      const key = previewKey(streamId, turnKey);
      if (!turnKey || !Number.isSafeInteger(revision) || revision < 1) return false;
      if (phase !== 'clear' && !text) return false;
      const lastPreviewSeq = lastPreviewSeqByStream.get(streamId) || 0;
      if (Number.isSafeInteger(seq) && seq > 0 && seq <= lastPreviewSeq) return false;
      if (revision <= (previewRevisions.get(key) || 0)) return false;
      if (!adapter.setComposerText(text)) return false;
      boundedSet(previewRevisions, key, revision, maxPreviewTurns);
      if (Number.isSafeInteger(seq) && seq > 0) {
        boundedSet(lastPreviewSeqByStream, streamId, seq, maxPreviewStreams);
      }
      return true;
    },
    async deliver(envelope) {
      const kind = String(envelope?.kind || 'question');
      const text = kind === 'question'
        ? sanitizeTranscriptCandidate(envelope?.text)
        : String(envelope?.text ?? '').trim();
      if (!text) return false;
      if (kind === 'boot') {
        stagedContext = text;
        clearCommittedPreview(envelope);
        onStatus('ARMED');
        return true;
      }
      const deliveryText = questionWithStagedContext(text);
      latestDeliveryId = envelope.id || `${Date.now()}`;
      const deliveryId = latestDeliveryId;

      if (adapter.isGenerating()) {
        if (!adapter.stopGenerating()) {
          onStatus('STOP FAIL');
          return false;
        }
        onStatus('SUPERSEDE');
        if (!await waitForIdle(deliveryId)) {
          if (deliveryId === latestDeliveryId) onStatus('STOP TIMEOUT');
          return false;
        }
      }

      if (deliveryId !== latestDeliveryId) return false;
      const envelopeKey = String(envelope.id || deliveryId);
      let baselineUserIds = submissionBaselines.get(envelopeKey);
      if (!(baselineUserIds instanceof Set)) {
        baselineUserIds = snapshotUserTurnIds(adapter);
        if (baselineUserIds instanceof Set) {
          boundedSet(submissionBaselines, envelopeKey, baselineUserIds, 16);
        }
      }
      if (hasNewSubmittedUserTurn(adapter, deliveryText, baselineUserIds, text)) {
        clearSubmittedComposer(adapter, deliveryText);
        submissionBaselines.delete(envelopeKey);
        stagedContext = '';
        clearCommittedPreview(envelope);
        onStatus('SENT');
        return true;
      }
      const submitted = await submitComposerWhenReady({
        adapter,
        text: deliveryText,
        yieldFn,
        maxChecks: maxSubmitChecks,
        maxConfirmChecks,
        baselineUserIds,
        confirmationText: text,
        isCurrent: () => deliveryId === latestDeliveryId
      });
      if (!submitted) {
        onStatus(adapter.findComposer?.() ? 'SUBMIT FAIL' : 'NO COMPOSER');
        return false;
      }
      submissionBaselines.delete(envelopeKey);
      stagedContext = '';
      clearCommittedPreview(envelope);
      onStatus('SENT');
      return true;
    },
    supersede(envelope) {
      latestDeliveryId = envelope?.id || `${Date.now()}`;
    }
  };
}

function runtimeTitleSuffix(sessionId = '') {
  return String(sessionId).trim().replace(/[^a-z0-9]+/gi, '_').toUpperCase();
}

export function runtimeTitle({ role, provider, sessionId = '' }) {
  const base = `PMIA_${String(role).toUpperCase()}_${String(provider).toUpperCase()}`;
  const suffix = runtimeTitleSuffix(sessionId);
  return suffix ? `${base}_${suffix}` : base;
}

export function runtimeLifecycleTitle(config, phase = 'ready') {
  const normalized = String(phase || 'ready').toLowerCase();
  if (normalized === 'ready') return runtimeTitle(config);
  const prefix = normalized === 'registered' ? 'PMIA_REGISTERED' : 'PMIA_BOOT';
  const base = `${prefix}_${String(config.role).toUpperCase()}_${String(config.provider).toUpperCase()}`;
  const suffix = runtimeTitleSuffix(config.sessionId);
  return suffix ? `${base}_${suffix}` : base;
}

export function defendTitle(doc, target, Observer = globalThis.MutationObserver) {
  let currentTarget = String(target);
  const restore = () => {
    if (doc.title !== currentTarget) doc.title = currentTarget;
  };
  restore();
  let observer = null;
  if (Observer && doc.head) {
    observer = new Observer(restore);
    observer.observe(doc.head, { childList: true, subtree: true, characterData: true });
  }
  restore.setTarget = nextTarget => {
    currentTarget = String(nextTarget);
    restore();
    return currentTarget;
  };
  restore.disconnect = () => observer?.disconnect();
  return restore;
}

export function installOverflowSafety(doc) {
  const id = 'pmia-overflow-safety';
  doc.getElementById(id)?.remove?.();
  const style = doc.createElement('style');
  style.id = id;
  style.textContent = `
    [data-message-author-role="assistant"],
    [data-message-author-role="user"],
    article,
    .prose,
    pre,
    code {
      max-width: 100% !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }
    pre {
      white-space: pre-wrap !important;
      overflow-x: auto !important;
    }
  `;
  (doc.head || doc.documentElement).appendChild(style);
  return () => style.remove();
}

export function redactSensitiveSessionText(text) {
  const value = String(text ?? '');
  const isSessionSetup = /\bSESSION CONTEXT\b/i.test(value)
    || /\bResume:\s*/i.test(value)
    || /\bJob Description:\s*/i.test(value);
  return isSessionSetup
    ? '[Session setup redacted from session log]'
    : value;
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
