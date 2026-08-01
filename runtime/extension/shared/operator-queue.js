import { isEnvelope } from './protocol.js';

function cloneEnvelope(envelope) {
  return {
    ...envelope,
    metadata: envelope?.metadata && typeof envelope.metadata === 'object'
      ? { ...envelope.metadata }
      : {}
  };
}

function cloneItem(item) {
  return {
    id: item.id,
    envelope: cloneEnvelope(item.envelope),
    queuedAt: item.queuedAt,
    updatedAt: item.updatedAt,
    reason: item.reason,
    attempts: item.attempts,
    status: item.status,
    lastError: item.lastError || ''
  };
}

function normalizeStoredItem(item) {
  if (!item || typeof item !== 'object' || !isEnvelope(item.envelope)) return null;
  const queuedAt = Number.isFinite(item.queuedAt) ? item.queuedAt : Date.now();
  return {
    id: String(item.id || item.envelope.id),
    envelope: cloneEnvelope(item.envelope),
    queuedAt,
    updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : queuedAt,
    reason: String(item.reason || 'paused'),
    attempts: Math.max(0, Number(item.attempts) || 0),
    status: ['queued', 'sending', 'failed', 'superseded'].includes(item.status) ? item.status : 'queued',
    lastError: String(item.lastError || '')
  };
}

export class OperatorQueue {
  #items = [];
  #maxItems;

  constructor(state = [], { maxItems = 20 } = {}) {
    this.#maxItems = Math.max(1, Number(maxItems) || 20);
    for (const item of Array.isArray(state) ? state : []) {
      const normalized = normalizeStoredItem(item);
      if (!normalized) continue;
      if (this.#items.some(existing => existing.id === normalized.id)) continue;
      this.#items.push(normalized);
    }
    if (this.#items.length > this.#maxItems) {
      this.#items = this.#items.slice(-this.#maxItems);
    }
  }

  get size() {
    return this.#items.length;
  }

  enqueue(envelope, { reason = 'paused', now = Date.now() } = {}) {
    if (!isEnvelope(envelope) || envelope.kind === 'boot') {
      return { accepted: false, reason: 'invalid_final', item: null, dropped: [] };
    }
    const id = String(envelope.id);
    const existing = this.#items.find(item => item.id === id);
    if (existing) {
      return { accepted: true, reason: 'duplicate', item: cloneItem(existing), dropped: [] };
    }
    const item = {
      id,
      envelope: cloneEnvelope(envelope),
      queuedAt: now,
      updatedAt: now,
      reason: String(reason || 'paused'),
      attempts: 0,
      status: 'queued',
      lastError: ''
    };
    this.#items.push(item);
    const dropped = [];
    while (this.#items.length > this.#maxItems) {
      dropped.push(cloneItem(this.#items.shift()));
    }
    return { accepted: true, reason: 'queued', item: cloneItem(item), dropped };
  }

  get(itemId) {
    const item = this.#items.find(candidate => candidate.id === itemId);
    return item ? cloneItem(item) : null;
  }

  latest() {
    const item = this.#items[this.#items.length - 1];
    return item ? cloneItem(item) : null;
  }

  markSending(itemId, now = Date.now()) {
    const item = this.#items.find(candidate => candidate.id === itemId);
    if (!item) return null;
    item.status = 'sending';
    item.attempts += 1;
    item.updatedAt = now;
    item.lastError = '';
    return cloneItem(item);
  }

  complete(itemId, {
    delivered = false,
    queued = false,
    superseded = false,
    reason = '',
    now = Date.now()
  } = {}) {
    const index = this.#items.findIndex(candidate => candidate.id === itemId);
    if (index < 0) return null;
    const item = this.#items[index];
    item.updatedAt = now;
    if (delivered) {
      this.#items.splice(index, 1);
      return { delivered: true, queued: false, superseded: false, item: cloneItem(item) };
    }
    if (queued) {
      item.status = 'queued';
      item.lastError = String(reason || 'receiver_unavailable');
      return { delivered: false, queued: true, superseded: false, item: cloneItem(item) };
    }
    item.status = superseded ? 'superseded' : 'failed';
    item.lastError = String(reason || (superseded ? 'stale_ack' : 'delivery_failed'));
    return { delivered: false, superseded, item: cloneItem(item) };
  }

  supersedeBefore(sequence, now = Date.now()) {
    const seq = Number(sequence) || 0;
    const changed = [];
    if (!seq) return changed;
    for (const item of this.#items) {
      const itemSeq = Number(item.envelope?.seq) || 0;
      if (!itemSeq || itemSeq >= seq || item.status === 'superseded') continue;
      item.status = 'superseded';
      item.updatedAt = now;
      item.lastError = 'newer_final_delivered';
      changed.push(cloneItem(item));
    }
    return changed;
  }

  discard(itemId) {
    const index = this.#items.findIndex(candidate => candidate.id === itemId);
    if (index < 0) return null;
    const [removed] = this.#items.splice(index, 1);
    return cloneItem(removed);
  }

  clear() {
    const removed = this.list();
    this.#items = [];
    return removed;
  }

  list() {
    return this.#items.map(cloneItem);
  }

  exportState() {
    return this.list();
  }
}
