export function scheduleFairBatch(partitions = [], { now = Date.now(), lastSource = '', maxConsecutive = 2 } = {}) {
  const values = (Array.isArray(partitions) ? partitions : []).map((item, index) => ({ ...item, index, source: String(item.source || item.provider || 'default'), oldestAt: Math.max(0, Number(item.oldestAt || 0)), firstSeq: Math.max(0, Number(item.firstSeq || 0)), consecutive: Math.max(0, Number(item.consecutive || 0)) }));
  if (!values.length) return { selected: null, reason: 'empty' };
  const eligible = values.filter(item => !(item.source === lastSource && item.consecutive >= maxConsecutive));
  const pool = eligible.length ? eligible : values;
  pool.sort((a, b) => a.oldestAt - b.oldestAt || a.firstSeq - b.firstSeq || a.index - b.index);
  const selected = pool[0];
  return { selected, reason: eligible.length ? 'oldest_fair_partition' : 'fairness_relaxed', waitMs: Math.max(0, now - selected.oldestAt), skippedSources: [...new Set(values.filter(item => !pool.includes(item)).map(item => item.source))] };
}
