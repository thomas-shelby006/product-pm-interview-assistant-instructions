export function promoteStarvedPartitions(partitions = [], { now = Date.now(), thresholdMs = 120000 } = {}) {
  const list = (Array.isArray(partitions) ? partitions : []).map((item, index) => ({ ...item, index, ageMs: Math.max(0, now - Number(item.oldestAt ?? now)) }));
  return list.sort((a, b) => {
    const aStarved = a.ageMs >= thresholdMs ? 1 : 0;
    const bStarved = b.ageMs >= thresholdMs ? 1 : 0;
    return bStarved - aStarved || b.ageMs - a.ageMs || Number(a.firstSeq || 0) - Number(b.firstSeq || 0) || a.index - b.index;
  }).map((item, rank) => ({ ...item, promoted: item.ageMs >= thresholdMs, rank }));
}

export function starvationSummary(partitions = [], options = {}) {
  const promoted = promoteStarvedPartitions(partitions, options);
  return { promotedCount: promoted.filter(item => item.promoted).length, oldestAgeMs: promoted[0]?.ageMs || 0, order: promoted.map(item => item.id || item.batchId || item.index) };
}
