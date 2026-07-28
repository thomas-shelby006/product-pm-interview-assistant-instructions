import { isActionableTranscript, normalizeTranscript } from '../../shared/transcript-filter.js';

const FINAL_FILLER = new Set([
  'ok', 'okay', 'yes', 'yeah', 'yep', 'fine', 'good', 'correct', 'right',
  'sure', 'continue', 'go on', 'go ahead', 'thank you', 'thanks', 'alright',
  'mhm', 'uh huh', 'um', 'uh'
]);

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map(message => ({
      id: String(message?.id || '').trim(),
      turnId: String(message?.turnId || '').trim(),
      role: String(message?.role || '').trim().toLowerCase(),
      text: String(message?.text || '').trim()
    }))
    .filter(message => message.id && message.text && ['user', 'assistant'].includes(message.role));
}

function isMeaningfulFinal(text) {
  const normalized = normalizeTranscript(text);
  return Boolean(normalized && !FINAL_FILLER.has(normalized));
}

export class DomTurnTracker {
  constructor({ fallbackMs = 1200 } = {}) {
    this.fallbackMs = fallbackMs;
    this.historicalIds = new Set();
    this.emittedIds = new Set();
    this.externalTexts = new Set();
    this.previewRevisions = new Map();
    this.queuedPreview = null;
    this.pending = null;
  }

  prime(messages) {
    for (const message of normalizeMessages(messages)) this.historicalIds.add(message.id);
    this.previewRevisions.clear();
    this.queuedPreview = null;
    this.pending = null;
  }

  markExternalFinal({ id = '', text = '' } = {}) {
    const normalizedId = String(id).trim();
    const normalizedText = normalizeTranscript(text);
    if (normalizedId) this.emittedIds.add(normalizedId);
    if (normalizedText) {
      this.externalTexts.add(normalizedText);
      if (this.externalTexts.size > 100) {
        this.externalTexts.delete(this.externalTexts.values().next().value);
      }
    }
    if (this.pending && (
      this.pending.id === normalizedId || normalizeTranscript(this.pending.text) === normalizedText
    )) this.pending = null;
    if (this.queuedPreview && (
      this.queuedPreview.turnKey === normalizedId ||
      normalizeTranscript(this.queuedPreview.text) === normalizedText
    )) this.queuedPreview = null;
  }

  isSuppressed(message) {
    return this.historicalIds.has(message.id)
      || this.emittedIds.has(message.id)
      || this.externalTexts.has(normalizeTranscript(message.text));
  }

  queuePreview(message) {
    const revision = (this.previewRevisions.get(message.id) || 0) + 1;
    this.previewRevisions.set(message.id, revision);
    this.queuedPreview = {
      turnKey: message.id,
      text: message.text,
      revision,
      phase: 'interim'
    };
  }

  takePreview() {
    const preview = this.queuedPreview;
    this.queuedPreview = null;
    return preview;
  }

  emit(message, boundary) {
    if (!isMeaningfulFinal(message.text) || this.isSuppressed(message)) return null;
    this.emittedIds.add(message.id);
    if (this.pending?.id === message.id) this.pending = null;
    if (this.queuedPreview?.turnKey === message.id) this.queuedPreview = null;
    return { id: message.id, text: message.text, boundary };
  }

  update(messages, now = Date.now()) {
    const ordered = normalizeMessages(messages);
    const emitted = [];

    for (let index = 0; index < ordered.length; index += 1) {
      const message = ordered[index];
      if (message.role !== 'user' || this.isSuppressed(message)) continue;
      const hasAssistantSuccessor = ordered[index + 1]?.role === 'assistant';
      if (!hasAssistantSuccessor) continue;
      const final = this.emit(message, 'assistant_successor');
      if (final) emitted.push(final);
    }

    const tailUser = [...ordered].reverse().find((message, reverseIndex) => {
      if (message.role !== 'user' || this.isSuppressed(message)) return false;
      const index = ordered.length - 1 - reverseIndex;
      return !ordered.slice(index + 1).some(candidate => candidate.role === 'assistant');
    });

    if (!tailUser) {
      if (this.pending && this.emittedIds.has(this.pending.id)) this.pending = null;
      return emitted;
    }

    if (!this.pending || this.pending.id !== tailUser.id || this.pending.text !== tailUser.text) {
      this.pending = { ...tailUser, lastChangedAt: now };
      this.queuePreview(tailUser);
    }
    return emitted;
  }

  pendingDelay(now = Date.now()) {
    if (!this.pending) return null;
    return Math.max(0, this.fallbackMs - (now - this.pending.lastChangedAt));
  }

  poll(now = Date.now(), { allowFallback = true } = {}) {
    if (!allowFallback || !this.pending) return [];
    if (now - this.pending.lastChangedAt < this.fallbackMs) return [];
    if (!isActionableTranscript(this.pending.text)) return [];
    const final = this.emit(this.pending, 'stable_tail_fallback');
    return final ? [final] : [];
  }
}
