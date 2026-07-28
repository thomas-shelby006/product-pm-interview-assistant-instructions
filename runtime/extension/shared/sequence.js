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

  accept(value) {
    const seq = normalizeSequence(value);
    if (seq > this.lastAcceptedSeq) this.lastAcceptedSeq = seq;
    return this.lastAcceptedSeq;
  }
}

export function nextSequence(current = 0) {
  const normalized = normalizeSequence(current);
  return normalized >= Number.MAX_SAFE_INTEGER ? 1 : normalized + 1;
}
