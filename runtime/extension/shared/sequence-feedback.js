function positiveSequence(value) {
  const sequence = Number(value);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : 0;
}

export function compactSequenceRanges(values) {
  const sequences = [...new Set((Array.isArray(values) ? values : [])
    .map(positiveSequence)
    .filter(Boolean))].sort((a, b) => a - b);
  const ranges = [];
  for (const sequence of sequences) {
    const current = ranges.at(-1);
    if (!current || sequence > current[1] + 1) ranges.push([sequence, sequence]);
    else current[1] = sequence;
  }
  return ranges;
}

function expandMissing(from, to, present) {
  const missing = [];
  for (let sequence = from; sequence <= to; sequence += 1) {
    if (!present.has(sequence)) missing.push(sequence);
  }
  return missing;
}

export function deriveSequenceFeedback(snapshot = {}, now = Date.now()) {
  const ackThrough = Math.max(0, Number(snapshot?.lastAcceptedSeq) || 0);
  const buffered = (Array.isArray(snapshot?.buffered) ? snapshot.buffered : [])
    .map(item => positiveSequence(item?.seq || item?.envelope?.seq))
    .filter(sequence => sequence > ackThrough);
  const present = new Set(buffered);
  const highestBufferedSeq = buffered.length ? Math.max(...buffered) : 0;
  const nackValues = highestBufferedSeq > ackThrough + 1
    ? expandMissing(ackThrough + 1, highestBufferedSeq - 1, present)
    : [];
  return {
    ackThrough,
    expectedSeq: ackThrough + 1,
    bufferedRanges: compactSequenceRanges(buffered),
    nackRanges: compactSequenceRanges(nackValues),
    bufferedCount: buffered.length,
    highestBufferedSeq,
    gapStartedAt: Math.max(0, Number(snapshot?.gapStartedAt) || 0),
    generatedAt: Number(now) || Date.now()
  };
}