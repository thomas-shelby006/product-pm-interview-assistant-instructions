function cloneEntry(entry) {
  return {
    ...entry,
    envelope: entry?.envelope
      ? { ...entry.envelope, metadata: { ...(entry.envelope.metadata || {}) } }
      : null
  };
}

function defaultMeasure(entries) {
  return entries.reduce((sum, entry) => sum + String(entry?.envelope?.text || '').length + 160, 0);
}

export function partitionEntries(entries = [], {
  maxMembers = 8,
  maxChars = 12000,
  measure = defaultMeasure
} = {}) {
  const memberLimit = Math.max(1, Number(maxMembers) || 8);
  const charLimit = Math.max(256, Number(maxChars) || 12000);
  const source = (Array.isArray(entries) ? entries : [])
    .map(cloneEntry)
    .filter(entry => entry?.id && entry.envelope);
  const partitions = [];
  let current = [];
  for (const entry of source) {
    const candidate = [...current, entry];
    const exceedsMembers = current.length > 0 && candidate.length > memberLimit;
    const exceedsChars = current.length > 0 && Math.max(0, Number(measure(candidate)) || 0) > charLimit;
    if (exceedsMembers || exceedsChars) {
      partitions.push(current);
      current = [entry];
    } else {
      current = candidate;
    }
  }
  if (current.length) partitions.push(current);
  return partitions;
}
