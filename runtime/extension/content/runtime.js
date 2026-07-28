function yieldToProvider() {
  return new Promise(resolve => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => resolve());
      return;
    }
    globalThis.queueMicrotask(resolve);
  });
}
export function createReceiverController({
  adapter,
  sleep,
  onStatus = () => {},
  stopTimeoutMs = 2500,
  stopPollMs = 75,
  yieldFn = yieldToProvider,
  maxSubmitChecks = 2
}) {
  let latestDeliveryId = '';
  let lastPreviewSeq = 0;
  const previewRevisions = new Map();

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
      if (!turnKey || !Number.isSafeInteger(revision) || revision < 1) return false;
      if (phase !== 'clear' && !text) return false;
      if (Number.isSafeInteger(seq) && seq > 0 && seq <= lastPreviewSeq) return false;
      if (revision <= (previewRevisions.get(turnKey) || 0)) return false;
      if (!adapter.setComposerText(text)) return false;
      previewRevisions.set(turnKey, revision);
      if (Number.isSafeInteger(seq) && seq > 0) lastPreviewSeq = seq;
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
      if (!adapter.setComposerText(text)) {
        onStatus('NO COMPOSER');
        return false;
      }
      for (let check = 0; check <= maxSubmitChecks; check += 1) {
        if (deliveryId !== latestDeliveryId) return false;
        const composerReady = adapter.composerContains?.(text) ?? true;
        const submitReady = adapter.canSubmit?.() ?? true;
        if (composerReady && submitReady && adapter.submit()) {
          onStatus('SENT');
          return true;
        }
        if (check < maxSubmitChecks) await yieldFn();
      }
      onStatus('SUBMIT FAIL');
      return false;
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
