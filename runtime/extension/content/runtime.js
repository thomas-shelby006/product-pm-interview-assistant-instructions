import { sanitizeTranscriptCandidate } from '../shared/transcript-filter.js';

export function yieldToProvider({
  requestFrame = typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame.bind(globalThis)
    : null,
  setTimer = typeof globalThis.setTimeout === 'function'
    ? globalThis.setTimeout.bind(globalThis)
    : null,
  clearTimer = typeof globalThis.clearTimeout === 'function'
    ? globalThis.clearTimeout.bind(globalThis)
    : null,
  MutationObserverCtor = globalThis.MutationObserver,
  observeTarget = globalThis.document?.documentElement || globalThis.document?.body || null,
  fallbackMs = 25
} = {}) {
  return new Promise(resolve => {
    let settled = false;
    let timer = null;
    let observer = null;
    const finish = (source = 'unknown') => {
      if (settled) return;
      settled = true;
      observer?.disconnect?.();
      if (timer !== null && clearTimer) clearTimer(timer);
      resolve(source);
    };
    if (observeTarget && typeof MutationObserverCtor === 'function') {
      observer = new MutationObserverCtor(() => finish('mutation'));
      observer.observe(observeTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    }
    if (requestFrame) requestFrame(() => finish('frame'));
    if (setTimer) timer = setTimer(() => finish('timer'), Math.max(1, Number(fallbackMs) || 25));
    else if (!requestFrame && !observer) globalThis.queueMicrotask(() => finish('microtask'));
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
  isCurrent = () => true,
  onSchedulerState = () => {},
  getVisibilityState = () => String(globalThis.document?.visibilityState || 'unknown'),
  nowFn = Date.now,
  retryAfterMs = 12000,
  retryAfterEmptyComposerMs = 12000,
  maxConfirmWaitMs = 45000
}) {
  const normalized = String(text ?? '').trim();
  if (!normalized || !isCurrent()) return false;
  const attempts = Math.max(1, Number(maxSubmitAttempts) || 1);
  const retryDelay = Math.max(0, Number(retryAfterMs) || 0);
  const confirmLimit = Math.max(retryDelay, Number(maxConfirmWaitMs) || 0);
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
        onSchedulerState({ phase: 'submit_triggered', reason: 'send_control', wakeSource: '', attempt, check, visibilityState: getVisibilityState() });
        break;
      }
      if (check < maxChecks) {
        const reason = !composerWritten ? 'composer_write' : !textReady ? 'composer_mismatch' : 'send_control';
        onSchedulerState({ phase: 'submit_wait', reason, wakeSource: '', attempt, check, visibilityState: getVisibilityState() });
        const wakeSource = await yieldFn();
        onSchedulerState({ phase: 'submit_wait', reason, wakeSource: String(wakeSource || 'unknown'), attempt, check, visibilityState: getVisibilityState() });
      }
    }
    if (!submitTriggered) return false;
    if (!(baselineUserIds instanceof Set)) return true;

    let retryAllowed = false;
    const confirmationStartedAt = Number(nowFn());
    for (let check = 0; check <= maxConfirmChecks; check += 1) {
      if (!isCurrent()) return false;
      if (hasNewSubmittedUserTurn(adapter, normalized, baselineUserIds, confirmationText)) {
        clearSubmittedComposer(adapter, normalized);
        onSchedulerState({ phase: 'idle', reason: 'rendered_turn_confirmed', wakeSource: '', attempt, check, visibilityState: getVisibilityState() });
        return true;
      }
      const elapsedMs = Math.max(0, Number(nowFn()) - confirmationStartedAt);
      const composerMatches = adapter.composerContains?.(normalized) ?? false;
      const composerText = typeof adapter.getComposerText === 'function'
        ? String(adapter.getComposerText() ?? '').trim()
        : null;
      const composerEmpty = composerText === null
        ? (adapter.isComposerEmpty?.() ?? false)
        : composerText.length === 0;
      const emptyRetryDelay = Math.max(0, Number(retryAfterEmptyComposerMs) || retryDelay);
      const retryThresholdReached = composerEmpty
        ? elapsedMs >= emptyRetryDelay
        : (check >= 48 || elapsedMs >= retryDelay);
      retryAllowed = attempt + 1 < attempts
        && retryThresholdReached
        && (composerMatches || composerEmpty)
        && !(adapter.isGenerating?.() ?? false);
      if (retryAllowed) break;
      if (elapsedMs >= confirmLimit) return false;
      if (check < maxConfirmChecks) {
        onSchedulerState({ phase: 'proof_wait', reason: 'rendered_turn', wakeSource: '', attempt, check, elapsedMs, visibilityState: getVisibilityState() });
        const wakeSource = await yieldFn();
        onSchedulerState({ phase: 'proof_wait', reason: 'rendered_turn', wakeSource: String(wakeSource || 'unknown'), attempt, check, elapsedMs: Math.max(0, Number(nowFn()) - confirmationStartedAt), visibilityState: getVisibilityState() });
      }
    }
    if (!retryAllowed) return false;
  }
  return false;
}


export function createReceiverController({
  adapter,
  sleep,
  onStatus = () => {},
  onProof = () => {},
  onSchedulerState = () => {},
  writePreview = text => adapter.setComposerText(text),
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
      if (!writePreview(text)) return false;
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
        onStatus('RECEIVER BUSY');
        onProof({ envelopeId: envelope.id, ok: false, reason: 'receiver_busy' });
        return false;
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
        onProof({
          envelopeId: envelope.id,
          ok: true,
          verified: true,
          proof: 'existing_rendered_turn'
        });
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
        isCurrent: () => deliveryId === latestDeliveryId,
        onSchedulerState
      });
      if (!submitted) {
        const reason = adapter.findComposer?.()
          ? 'rendered_turn_not_confirmed'
          : 'receiver_composer_missing';
        onStatus(reason === 'receiver_composer_missing' ? 'NO COMPOSER' : 'SUBMIT FAIL');
        onProof({ envelopeId: envelope.id, ok: false, reason });
        return false;
      }
      submissionBaselines.delete(envelopeKey);
      stagedContext = '';
      clearCommittedPreview(envelope);
      onStatus('SENT');
      const verified = baselineUserIds instanceof Set;
      onProof({
        envelopeId: envelope.id,
        ok: true,
        verified,
        proof: verified ? 'new_rendered_turn' : 'submit_action_only'
      });
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
