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
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function hasNewSubmittedUserTurn(adapter, text, baselineUserIds) {
  if (!(baselineUserIds instanceof Set) || typeof adapter.getConversationMessages !== 'function') {
    return false;
  }
  const expected = normalizedTurnText(text);
  return adapter.getConversationMessages().some(message => (
    message.role === 'user'
    && !baselineUserIds.has(String(message.id || ''))
    && normalizedTurnText(message.text) === expected
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
  maxChecks = 90,
  maxConfirmChecks = 180,
  baselineUserIds = snapshotUserTurnIds(adapter),
  isCurrent = () => true
}) {
  const normalized = String(text ?? '').trim();
  if (!normalized || !isCurrent()) return false;
  let composerWritten = false;
  let submitTriggered = false;
  for (let check = 0; check <= maxChecks; check += 1) {
    if (!isCurrent()) return false;
    if (!composerWritten) composerWritten = Boolean(adapter.setComposerText(normalized));
    const composerReady = composerWritten && (adapter.composerContains?.(normalized) ?? true);
    const submitReady = composerReady && (adapter.canSubmit?.() ?? true);
    if (submitReady && adapter.submit()) {
      submitTriggered = true;
      break;
    }
    if (check < maxChecks) await yieldFn();
  }
  if (!submitTriggered) return false;
  if (!(baselineUserIds instanceof Set)) return true;
  for (let check = 0; check <= maxConfirmChecks; check += 1) {
    if (!isCurrent()) return false;
    if (hasNewSubmittedUserTurn(adapter, normalized, baselineUserIds)) {
      clearSubmittedComposer(adapter, normalized);
      return true;
    }
    if (check < maxConfirmChecks) await yieldFn();
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
  maxSubmitChecks = 90,
  maxConfirmChecks = 180,
  maxPreviewTurns = 64,
  maxPreviewStreams = 8
}) {
  let latestDeliveryId = '';
  const lastPreviewSeqByStream = new Map();
  const previewRevisions = new Map();
  const submissionBaselines = new Map();

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

  return {
    preview(preview) {
      const turnKey = String(preview?.turnKey || '').trim();
      const text = String(preview?.text ?? '').trim();
      const phase = String(preview?.phase || 'interim');
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
      const text = String(envelope?.text ?? '').trim();
      if (!text) return false;
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
      if (hasNewSubmittedUserTurn(adapter, text, baselineUserIds)) {
        clearSubmittedComposer(adapter, text);
        submissionBaselines.delete(envelopeKey);
        clearCommittedPreview(envelope);
        onStatus('SENT');
        return true;
      }
      const submitted = await submitComposerWhenReady({
        adapter,
        text,
        yieldFn,
        maxChecks: maxSubmitChecks,
        maxConfirmChecks,
        baselineUserIds,
        isCurrent: () => deliveryId === latestDeliveryId
      });
      if (!submitted) {
        onStatus(adapter.findComposer?.() ? 'SUBMIT FAIL' : 'NO COMPOSER');
        return false;
      }
      submissionBaselines.delete(envelopeKey);
      clearCommittedPreview(envelope);
      onStatus('SENT');
      return true;
    },
    supersede(envelope) {
      latestDeliveryId = envelope?.id || `${Date.now()}`;
    }
  };
}

export function runtimeTitle({ role, provider, sessionId = '' }) {
  const base = `PMIA_${String(role).toUpperCase()}_${String(provider).toUpperCase()}`;
  const suffix = String(sessionId).trim().replace(/[^a-z0-9]+/gi, '_').toUpperCase();
  return suffix ? `${base}_${suffix}` : base;
}

export function defendTitle(doc, target, Observer = globalThis.MutationObserver) {
  const restore = () => {
    if (doc.title !== target) doc.title = target;
  };
  restore();
  let observer = null;
  if (Observer && doc.head) {
    observer = new Observer(restore);
    observer.observe(doc.head, { childList: true, subtree: true, characterData: true });
  }
  restore.disconnect = () => observer?.disconnect();
  return restore;
}

export function redactSensitiveSessionText(text) {
  const value = String(text ?? '');
  if (!/\bResume:\s*/i.test(value) && !/\bJob Description:\s*/i.test(value)) return value;
  return value.replace(
    /\n?Resume:\s*\n?[\s\S]*$/i,
    '\n[Resume and Job Description redacted from session log]'
  );
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
