import { isActionableTranscript, isStrongFinalTranscript, isTransientTranscriptStatus, normalizeTranscript, sanitizeTranscriptCandidate } from '../../shared/transcript-filter.js';

const FINAL_FILLER = new Set([
  'ok', 'okay', 'yes', 'yeah', 'yep', 'fine', 'good', 'correct', 'right',
  'sure', 'continue', 'go on', 'go ahead', 'thank you', 'thanks', 'alright',
  'mhm', 'uh huh', 'um', 'uh'
]);

function normalizeMessages(messages, limit = Infinity) {
  const source = Array.isArray(messages) ? messages : [];
  const bounded = Number.isFinite(limit) ? source.slice(-limit) : source;
  return bounded
    .map(message => ({
      id: String(message?.id || '').trim(),
      turnId: String(message?.turnId || '').trim(),
      role: String(message?.role || '').trim().toLowerCase(),
      text: sanitizeTranscriptCandidate(message?.text)
    }))
    .filter(message => message.id && message.text && ['user', 'assistant'].includes(message.role));
}

function isMeaningfulFinal(text) {
  const normalized = normalizeTranscript(text);
  return Boolean(normalized && !FINAL_FILLER.has(normalized) && !isTransientTranscriptStatus(text));
}

function canonicalTranscript(text) {
  return normalizeTranscript(text)
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function isExternalShadowMatch(first, second) {
  if (Math.min(first.length, second.length) < 20) return false;
  return first.includes(second) || second.includes(first);
}

export class DomTurnTracker {
  constructor({
    fallbackMs = 160,
    historyLimit = 512,
    duplicateTextWindowMs = 30000,
    externalShadowMs = 8000
  } = {}) {
    this.fallbackMs = fallbackMs;
    this.duplicateTextWindowMs = Math.max(1000, Number(duplicateTextWindowMs) || 30000);
    this.externalShadowMs = Math.max(1000, Number(externalShadowMs) || 8000);
    this.historyLimit = Math.max(16, Number(historyLimit) || 512);
    this.scanMessageLimit = this.historyLimit * 2;
    this.lastScanSize = 0;
    this.historicalIds = new Set();
    this.emittedIds = new Set();
    this.externalShadows = [];
    this.recentEmissionFingerprints = new Map();
    this.previewRevisions = new Map();
    this.emittedTextById = new Map();
    this.revisionCounts = new Map();
    this.queuedPreview = null;
    this.pending = null;
  }

  rememberSet(set, value, limit = this.historyLimit) {
    if (!value) return;
    if (set.has(value)) set.delete(value);
    set.add(value);
    while (set.size > limit) set.delete(set.values().next().value);
  }

  rememberRevision(id, revision) {
    if (this.previewRevisions.has(id)) this.previewRevisions.delete(id);
    this.previewRevisions.set(id, revision);
    while (this.previewRevisions.size > this.historyLimit) {
      this.previewRevisions.delete(this.previewRevisions.keys().next().value);
    }
  }

  rememberEmissionText(id, text) {
    const key = String(id || '').trim();
    const value = normalizeTranscript(text);
    if (!key || !value) return;
    if (this.emittedTextById.has(key)) this.emittedTextById.delete(key);
    this.emittedTextById.set(key, value);
    while (this.emittedTextById.size > this.historyLimit) {
      this.emittedTextById.delete(this.emittedTextById.keys().next().value);
    }
  }

  nextRevisionId(id) {
    const key = String(id || '').trim();
    const revision = (this.revisionCounts.get(key) || 0) + 1;
    if (this.revisionCounts.has(key)) this.revisionCounts.delete(key);
    this.revisionCounts.set(key, revision);
    while (this.revisionCounts.size > this.historyLimit) {
      this.revisionCounts.delete(this.revisionCounts.keys().next().value);
    }
    return `${key}:revision:${revision}`;
  }

  rememberExternalShadow(text, now) {
    const canonical = canonicalTranscript(text);
    if (canonical.length < 20) return;
    this.externalShadows.push({ canonical, expiresAt: now + this.externalShadowMs });
    while (this.externalShadows.length > 8) this.externalShadows.shift();
  }

  consumeExternalShadow(message, now) {
    const canonical = canonicalTranscript(message.text);
    this.externalShadows = this.externalShadows.filter(shadow => shadow.expiresAt >= now);
    const index = this.externalShadows.findIndex(shadow =>
      isExternalShadowMatch(canonical, shadow.canonical)
    );
    if (index < 0) return false;
    this.externalShadows.splice(index, 1);
    this.rememberSet(this.emittedIds, message.id);
    if (this.pending?.id === message.id) this.pending = null;
    if (this.queuedPreview?.turnKey === message.id) this.queuedPreview = null;
    return true;
  }

  emissionFingerprint(message) {
    return canonicalTranscript(message?.text);
  }

  wasRecentlyEmitted(message, now) {
    const fingerprint = this.emissionFingerprint(message);
    if (!fingerprint) return false;
    for (const [candidate, emittedAt] of this.recentEmissionFingerprints) {
      if (now - emittedAt > this.duplicateTextWindowMs) {
        this.recentEmissionFingerprints.delete(candidate);
      }
    }
    return this.recentEmissionFingerprints.has(fingerprint);
  }

  rememberEmission(message, now) {
    const fingerprint = this.emissionFingerprint(message);
    if (!fingerprint) return;
    if (this.recentEmissionFingerprints.has(fingerprint)) {
      this.recentEmissionFingerprints.delete(fingerprint);
    }
    this.recentEmissionFingerprints.set(fingerprint, now);
    while (this.recentEmissionFingerprints.size > 64) {
      this.recentEmissionFingerprints.delete(this.recentEmissionFingerprints.keys().next().value);
    }
  }

  hasEarlierEmittedMatchingTurn(ordered, index, message) {
    const fingerprint = this.emissionFingerprint(message);
    if (!fingerprint) return false;
    return ordered.slice(0, index).some(candidate => (
      candidate.role === 'user'
      && candidate.id !== message.id
      && this.emittedIds.has(candidate.id)
      && this.emissionFingerprint(candidate) === fingerprint
    ));
  }

  prime(messages) {
    this.historicalIds.clear();
    for (const message of normalizeMessages(messages, this.scanMessageLimit)) {
      this.rememberSet(this.historicalIds, message.id, this.scanMessageLimit);
    }
    this.previewRevisions.clear();
    this.emittedTextById.clear();
    this.revisionCounts.clear();
    this.recentEmissionFingerprints.clear();
    this.externalShadows = [];
    this.queuedPreview = null;
    this.pending = null;
  }

  markExternalFinal({ id = '', text = '', now = Date.now() } = {}) {
    const normalizedId = String(id).trim();
    const normalizedText = normalizeTranscript(text);
    if (normalizedId) this.rememberSet(this.emittedIds, normalizedId);
    if (normalizedId && normalizedText) this.rememberEmissionText(normalizedId, normalizedText);
    if (normalizedText) this.rememberExternalShadow(normalizedText, now);
    if (this.pending && (
      this.pending.id === normalizedId || normalizeTranscript(this.pending.text) === normalizedText
    )) this.pending = null;
    if (this.queuedPreview && (
      this.queuedPreview.turnKey === normalizedId ||
      normalizeTranscript(this.queuedPreview.text) === normalizedText
    )) this.queuedPreview = null;
  }

  isSuppressed(message, now = Date.now()) {
    if (this.historicalIds.has(message.id) || this.emittedIds.has(message.id)) return true;
    return this.consumeExternalShadow(message, now);
  }

  queuePreview(message) {
    if (isTransientTranscriptStatus(message?.text)) return;
    const revision = (this.previewRevisions.get(message.id) || 0) + 1;
    this.rememberRevision(message.id, revision);
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

  emit(message, boundary, now = Date.now(), { allowRecentRepeat = false } = {}) {
    if (!isMeaningfulFinal(message.text) || this.isSuppressed(message, now)) return null;
    if (!allowRecentRepeat && this.wasRecentlyEmitted(message, now)) {
      this.rememberSet(this.emittedIds, message.id);
      return null;
    }
    this.rememberSet(this.emittedIds, message.id);
    this.rememberEmission(message, now);
    this.rememberEmissionText(message.revisionOf || message.id, message.text);
    if (this.pending?.id === message.id || this.pending?.id === message.revisionOf) this.pending = null;
    if (this.queuedPreview?.turnKey === message.id || this.queuedPreview?.turnKey === message.revisionOf) this.queuedPreview = null;
    const final = { id: message.id, text: message.text, boundary };
    if (message.sourceTurnId) final.sourceTurnId = String(message.sourceTurnId);
    if (message.continuationOf) final.continuationOf = String(message.continuationOf);
    if (message.revisionOf) final.revisionOf = String(message.revisionOf);
    return final;
  }

  update(messages, now = Date.now(), { renderedBoundary = false } = {}) {
    const ordered = normalizeMessages(messages, this.scanMessageLimit);
    this.lastScanSize = ordered.length;
    const emitted = [];

    if (renderedBoundary) {
      for (const message of ordered) {
        if (message.role !== 'user' || !this.emittedIds.has(message.id)) continue;
        const previousText = this.emittedTextById.get(message.id) || '';
        const previousCanonical = canonicalTranscript(previousText);
        const currentCanonical = canonicalTranscript(message.text);
        const isGrowth = previousCanonical.length >= 8
          && currentCanonical.length > previousCanonical.length
          && currentCanonical.includes(previousCanonical);
        if (!isGrowth) continue;
        const sourceTurnId = String(message.turnId || message.id);
        const revisionMessage = {
          ...message,
          id: this.nextRevisionId(message.id),
          sourceTurnId,
          continuationOf: sourceTurnId,
          revisionOf: message.id
        };
        const final = this.emit(revisionMessage, 'rendered_user_turn_revision', now, { allowRecentRepeat: true });
        if (final) emitted.push(final);
      }
    }

    for (let index = 0; index < ordered.length; index += 1) {
      const message = ordered[index];
      if (message.role !== 'user' || this.isSuppressed(message, now)) continue;
      const hasAssistantSuccessor = ordered[index + 1]?.role === 'assistant';
      if (!hasAssistantSuccessor) continue;
      const allowRecentRepeat = this.hasEarlierEmittedMatchingTurn(ordered, index, message);
      const final = this.emit(message, 'assistant_successor', now, { allowRecentRepeat });
      if (final) emitted.push(final);
    }

    let tailIndex = -1;
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const message = ordered[index];
      if (message.role !== 'user' || this.isSuppressed(message, now)) continue;
      if (ordered.slice(index + 1).some(candidate => candidate.role === 'assistant')) continue;
      tailIndex = index;
      break;
    }
    const tailUser = tailIndex >= 0 ? ordered[tailIndex] : null;

    if (!tailUser) {
      if (this.pending && this.emittedIds.has(this.pending.id)) this.pending = null;
      return emitted;
    }

    if (!this.pending || this.pending.id !== tailUser.id || this.pending.text !== tailUser.text) {
      this.pending = {
        ...tailUser,
        lastChangedAt: now,
        allowRecentRepeat: this.hasEarlierEmittedMatchingTurn(ordered, tailIndex, tailUser)
      };
      this.queuePreview(tailUser);
      const stableRenderedIdentity = !String(tailUser.id || '').startsWith('dom-');
      if (stableRenderedIdentity && renderedBoundary) {
        const final = this.emit(tailUser, 'rendered_user_turn', now, {
          allowRecentRepeat: Boolean(this.pending?.allowRecentRepeat)
        });
        if (final) emitted.push(final);
      }
    }
    return emitted;
  }

  canFinalizeStrongTail() {
    return Boolean(this.pending && isStrongFinalTranscript(this.pending.text));
  }

  pendingDelay(now = Date.now()) {
    if (!this.pending) return null;
    return Math.max(0, this.fallbackMs - (now - this.pending.lastChangedAt));
  }

  poll(now = Date.now(), { allowFallback = true } = {}) {
    if (!allowFallback || !this.pending) return [];
    if (now - this.pending.lastChangedAt < this.fallbackMs) return [];
    if (!isActionableTranscript(this.pending.text)) return [];
    const final = this.emit(this.pending, 'stable_tail_fallback', now, {
      allowRecentRepeat: Boolean(this.pending.allowRecentRepeat)
    });
    return final ? [final] : [];
  }
}
