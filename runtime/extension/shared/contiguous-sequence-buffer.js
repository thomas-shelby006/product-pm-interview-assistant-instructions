function normalizeSeq(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function cloneEnvelope(envelope) {
  return envelope && typeof envelope === 'object'
    ? { ...envelope, metadata: { ...(envelope.metadata || {}) } }
    : null;
}

export class ContiguousSequenceBuffer {
  #lastAcceptedSeq;
  #buffer = new Map();
  #maxBuffered;
  #gapTimeoutMs;
  #gapStartedAt = 0;

  constructor(snapshot = {}, { maxBuffered = 200, gapTimeoutMs = 3000 } = {}) {
    this.#lastAcceptedSeq = normalizeSeq(snapshot?.lastAcceptedSeq || snapshot || 0);
    this.#maxBuffered = Math.max(1, Number(maxBuffered) || 200);
    this.#gapTimeoutMs = Math.max(250, Number(gapTimeoutMs) || 3000);
    for (const item of Array.isArray(snapshot?.buffered) ? snapshot.buffered : []) {
      const seq = normalizeSeq(item?.seq || item?.envelope?.seq);
      if (!seq || seq <= this.#lastAcceptedSeq || !item?.envelope) continue;
      this.#buffer.set(seq, {
        seq,
        envelope: cloneEnvelope(item.envelope),
        receivedAt: Number(item.receivedAt || Date.now())
      });
    }
    this.#gapStartedAt = Number(snapshot?.gapStartedAt || 0);
    this.#refreshGap(Date.now());
  }

  get lastAcceptedSeq() { return this.#lastAcceptedSeq; }
  get bufferedCount() { return this.#buffer.size; }
  get expectedSeq() { return this.#lastAcceptedSeq + 1; }

  offer(envelope, now = Date.now()) {
    const seq = normalizeSeq(envelope?.seq);
    if (!seq) return { accepted: true, unsequenced: true, duplicate: false, reason: 'unsequenced' };
    if (seq <= this.#lastAcceptedSeq) {
      return { accepted: true, duplicate: true, reason: 'duplicate_ack', seq, expectedSeq: this.expectedSeq };
    }
    if (this.#buffer.has(seq)) {
      return { accepted: true, duplicate: true, buffered: true, reason: 'duplicate_buffered', seq, expectedSeq: this.expectedSeq };
    }
    if (this.#buffer.size >= this.#maxBuffered) {
      return { accepted: false, duplicate: false, reason: 'gap_buffer_full', seq, expectedSeq: this.expectedSeq };
    }
    this.#buffer.set(seq, { seq, envelope: cloneEnvelope(envelope), receivedAt: Number(now) || Date.now() });
    this.#refreshGap(now);
    return {
      accepted: true,
      duplicate: false,
      buffered: seq !== this.expectedSeq,
      ready: seq === this.expectedSeq,
      reason: seq === this.expectedSeq ? 'ready' : 'buffered_gap',
      seq,
      expectedSeq: this.expectedSeq,
      bufferedCount: this.#buffer.size
    };
  }

  peekReady() {
    return cloneEnvelope(this.#buffer.get(this.expectedSeq)?.envelope || null);
  }

  confirm(seq, now = Date.now()) {
    const normalized = normalizeSeq(seq);
    if (normalized !== this.expectedSeq || !this.#buffer.has(normalized)) return false;
    this.#buffer.delete(normalized);
    this.#lastAcceptedSeq = normalized;
    this.#refreshGap(now);
    return true;
  }

  status(now = Date.now()) {
    const sequences = [...this.#buffer.keys()].sort((a, b) => a - b);
    const hasGap = sequences.length > 0 && sequences[0] > this.expectedSeq;
    const ageMs = hasGap && this.#gapStartedAt ? Math.max(0, Number(now) - this.#gapStartedAt) : 0;
    return {
      expectedSeq: this.expectedSeq,
      bufferedCount: sequences.length,
      capacity: this.#maxBuffered,
      highestBufferedSeq: sequences.at(-1) || 0,
      hasGap,
      gapAgeMs: ageMs,
      timedOut: hasGap && ageMs >= this.#gapTimeoutMs
    };
  }

  snapshot() {
    return {
      lastAcceptedSeq: this.#lastAcceptedSeq,
      gapStartedAt: this.#gapStartedAt,
      buffered: [...this.#buffer.values()]
        .sort((a, b) => a.seq - b.seq)
        .map(item => ({ ...item, envelope: cloneEnvelope(item.envelope) }))
    };
  }

  #refreshGap(now) {
    const sequences = [...this.#buffer.keys()].sort((a, b) => a - b);
    const hasGap = sequences.length > 0 && sequences[0] > this.expectedSeq;
    if (hasGap && !this.#gapStartedAt) this.#gapStartedAt = Number(now) || Date.now();
    if (!hasGap) this.#gapStartedAt = 0;
  }
}

export function createContiguousSequenceBuffer(snapshot, options) {
  return new ContiguousSequenceBuffer(snapshot, options);
}
