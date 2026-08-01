export function createDurableTombstone(entry = {}, now = Date.now()) {
  return {
    id: String(entry.id || ''),
    seq: Math.max(0, Number(entry.envelope?.seq || entry.seq || 0)),
    sourceProvider: String(entry.envelope?.sourceProvider || entry.sourceProvider || ''),
    state: String(entry.state || 'proven'),
    batchId: String(entry.batchId || ''),
    proofId: String(entry.proof?.proofId || entry.proof?.id || ''),
    compactedAt: now
  };
}

export function mergeDurableTombstones(current = [], entries = [], limit = 2000) {
  const map = new Map((Array.isArray(current) ? current : []).map(item => [String(item.id), { ...item }]));
  for (const entry of Array.isArray(entries) ? entries : []) {
    const stone = createDurableTombstone(entry);
    if (stone.id) map.set(stone.id, stone);
  }
  return [...map.values()].sort((a, b) => Number(a.seq) - Number(b.seq) || String(a.id).localeCompare(String(b.id))).slice(-Math.max(1, Number(limit) || 2000));
}

export function tombstoneMatches(tombstones = [], envelope = {}) {
  const id = String(envelope.id || '');
  const seq = Number(envelope.seq || 0);
  return (tombstones || []).find(item => item.id === id || (seq && item.seq === seq && item.sourceProvider === String(envelope.sourceProvider || ''))) || null;
}
