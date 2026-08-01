export function deriveGapWatch(snapshot, now = Date.now()) {
  const timeline = Array.isArray(snapshot?.timeline) ? snapshot.timeline : [];
  let latest = null;
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const event = timeline[index];
    if (event?.type === 'sequence_gap' || event?.type === 'sequence_gap_cleared') {
      latest = event;
      break;
    }
  }
  if (!latest || latest.type === 'sequence_gap_cleared') {
    return { state: 'clear', expectedSeq: 0, bufferedCount: 0, ageMs: 0, label: 'No gap' };
  }
  const data = latest.data || {};
  const ageMs = Math.max(0, Number(now) - Number(latest.at || now));
  return {
    state: data.timedOut || ageMs >= 3000 ? 'blocked' : 'waiting',
    expectedSeq: Number(data.expectedSeq || 0),
    bufferedCount: Number(data.bufferedCount || 0),
    highestBufferedSeq: Number(data.highestBufferedSeq || 0),
    ageMs,
    label: data.timedOut || ageMs >= 3000 ? 'Gap blocked' : 'Waiting for sequence'
  };
}
