import { isActionableTranscript } from '../shared/transcript-filter.js';

function normalizeCandidate(input) {
  if (input && typeof input === 'object') {
    return {
      text: String(input.text ?? '').trim(),
      source: String(input.source || 'unknown')
    };
  }
  return { text: String(input ?? '').trim(), source: 'unknown' };
}

export class StableTranscriptForwarder {
  constructor({ stableMs = 850, sourceStableMs = {} } = {}) {
    this.stableMs = stableMs;
    this.sourceStableMs = { ...sourceStableMs };
    this.pending = '';
    this.pendingSource = 'unknown';
    this.pendingSince = 0;
    this.pendingStableMs = stableMs;
    this.lastEmitted = '';
  }

  consider(input, now = Date.now()) {
    const candidate = normalizeCandidate(input);
    if (!isActionableTranscript(candidate.text)) {
      this.pending = '';
      this.pendingSource = 'unknown';
      this.pendingSince = 0;
      return null;
    }
    if (candidate.text === this.lastEmitted) return null;
    const requiredStableMs = this.sourceStableMs[candidate.source] ?? this.stableMs;
    if (candidate.text !== this.pending) {
      this.pending = candidate.text;
      this.pendingSince = now;
    }
    this.pendingSource = candidate.source;
    this.pendingStableMs = requiredStableMs;
    return null;
  }

  markEmitted(text) {
    const normalized = String(text ?? '').trim();
    if (!normalized) return;
    this.lastEmitted = normalized;
    if (this.pending === normalized) {
      this.pending = '';
      this.pendingSource = 'unknown';
      this.pendingSince = 0;
    }
  }

  pendingDelay(now = Date.now()) {
    if (!this.pending || this.pending === this.lastEmitted) return null;
    return Math.max(0, this.pendingStableMs - (now - this.pendingSince));
  }

  pollCandidate(now = Date.now()) {
    if (!this.pending || this.pending === this.lastEmitted) return null;
    if (now - this.pendingSince < this.pendingStableMs) return null;
    const result = { text: this.pending, source: this.pendingSource };
    this.lastEmitted = this.pending;
    this.pending = '';
    this.pendingSource = 'unknown';
    this.pendingSince = 0;
    return result;
  }

  poll(now = Date.now()) {
    return this.pollCandidate(now)?.text || null;
  }
}

export function primeHistoricalCandidate(forwarder, candidate) {
  if (!forwarder || candidate?.source !== 'user_message') return false;
  const text = String(candidate.text || '').trim();
  if (!text) return false;
  forwarder.markEmitted(text);
  return true;
}

export function createReceiverController({
  adapter,
  sleep,
  onStatus = () => {},
  stopTimeoutMs = 2500,
  stopPollMs = 75
}) {
  let latestDeliveryId = '';

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
      await sleep(60);
      if (deliveryId !== latestDeliveryId) return false;
      const submitted = adapter.submit();
      onStatus(submitted ? 'SENT' : 'SUBMIT FAIL');
      return submitted;
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
