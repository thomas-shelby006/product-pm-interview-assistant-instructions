function normalizeSequence(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export class SequenceGate {
  constructor(lastAcceptedSeq = 0) {
    this.lastAcceptedSeq = normalizeSequence(lastAcceptedSeq);
  }

  check(value) {
    const seq = normalizeSequence(value);
    if (!seq) {
      return {
        accepted: true,
        reason: 'unsequenced',
        lastAcceptedSeq: this.lastAcceptedSeq
      };
    }
    if (seq === this.lastAcceptedSeq) {
      return {
        accepted: false,
        reason: 'duplicate',
        lastAcceptedSeq: this.lastAcceptedSeq
      };
    }
    if (seq < this.lastAcceptedSeq) {
      return {
        accepted: false,
        reason: 'stale',
        lastAcceptedSeq: this.lastAcceptedSeq
      };
    }    return {
      accepted: true,
      reason: 'new',
      lastAcceptedSeq: this.lastAcceptedSeq
    };
  }

  admit(value) {
    const seq = normalizeSequence(value);
    const previousAcceptedSeq = this.lastAcceptedSeq;
    if (!seq) {
      return { accepted: true, duplicate: false, reason: 'unsequenced', seq, previousAcceptedSeq };
    }
    if (seq === previousAcceptedSeq) {
      return { accepted: true, duplicate: true, reason: 'duplicate', seq, previousAcceptedSeq };
    }
    if (seq < previousAcceptedSeq) {
      return { accepted: false, duplicate: false, reason: 'stale', seq, previousAcceptedSeq };
    }
    return { accepted: true, duplicate: false, reason: 'new', seq, previousAcceptedSeq };
  }

  accept(value) {
    const seq = normalizeSequence(value);
    if (seq > this.lastAcceptedSeq) this.lastAcceptedSeq = seq;
    return this.lastAcceptedSeq;
  }

  restore(value) {
    this.lastAcceptedSeq = normalizeSequence(value);
    return this.lastAcceptedSeq;
  }
}

export function nextSequence(current = 0) {
  const normalized = normalizeSequence(current);
  return normalized >= Number.MAX_SAFE_INTEGER ? 1 : normalized + 1;
}
