import { isActionableTranscript } from '../shared/transcript-filter.js';

export class StableTranscriptForwarder {
  constructor({ stableMs = 850 } = {}) {
    this.stableMs = stableMs;
    this.pending = '';
    this.pendingSince = 0;
    this.lastEmitted = '';
  }

  consider(text, now = Date.now()) {
    const normalized = String(text ?? '').trim();
    if (!isActionableTranscript(normalized)) {
      this.pending = '';
      this.pendingSince = 0;
      return null;
    }
    if (normalized === this.lastEmitted) return null;
    if (normalized !== this.pending) {
      this.pending = normalized;
      this.pendingSince = now;
    }
    return null;
  }

  markEmitted(text) {
    const normalized = String(text ?? '').trim();
    if (!normalized) return;
    this.lastEmitted = normalized;
    if (this.pending === normalized) {
      this.pending = '';
      this.pendingSince = 0;
    }
  }

  poll(now = Date.now()) {
    if (!this.pending || this.pending === this.lastEmitted) return null;
    if (now - this.pendingSince < this.stableMs) return null;
    this.lastEmitted = this.pending;
    const result = this.pending;
    this.pending = '';
    this.pendingSince = 0;
    return result;
  }
}

export function createReceiverController({ adapter, sleep, onStatus = () => {} }) {
  let latestDeliveryId = '';
  return {
    async deliver(envelope) {
      const text = String(envelope?.text ?? '').trim();
      if (!text) return false;
      latestDeliveryId = envelope.id || `${Date.now()}`;
      const deliveryId = latestDeliveryId;
      if (adapter.isGenerating()) {
        adapter.stopGenerating();
        onStatus('SUPERSEDE');
        await sleep(180);
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

export function runtimeTitle({ role, provider }) {
  return `PMIA_${String(role).toUpperCase()}_${String(provider).toUpperCase()}`;
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
  return value.replace(/\n?Resume:\s*\n?[\s\S]*$/i,
    '\n[Resume and Job Description redacted from session log]');
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
