function entryFor(ledger = [], id = '') { return ledger.find(item => item.id === id) || null; }
function chars(item) { return String(item?.envelope?.text || '').length; }
function projectBatch(batch, ledger) {
  if (!batch) return null;
  const memberIds = [...(batch.memberIds || batch.entries?.map(item => item.id) || [])];
  const entries = memberIds.map(id => entryFor(ledger, id)).filter(Boolean);
  return {
    id: String(batch.id || batch.batchId || ''),
    memberIds,
    count: memberIds.length,
    foundCount: entries.length,
    missingIds: memberIds.filter(id => !entries.some(item => item.id === id)),
    totalChars: entries.reduce((sum, item) => sum + chars(item), 0),
    latestId: memberIds.at(-1) || '',
    sequences: entries.map(item => Number(item.envelope?.seq || 0)),
    states: entries.map(item => String(item.state || 'persisted')),
    frozen: Boolean(batch.frozen || batch.id || batch.batchId)
  };
}

export function deriveBatchPreview(snapshot = {}) {
  const ledger = Array.isArray(snapshot.ledger) ? snapshot.ledger : [];
  const active = projectBatch(snapshot.batchState?.active, ledger);
  const next = projectBatch(snapshot.batchState?.next, ledger);
  const budget = snapshot.batchState?.budget || null;
  return {
    active,
    next,
    budget: budget ? { provider: String(budget.provider || ''), maxMembers: Math.max(1, Number(budget.maxMembers || 1)), maxChars: Math.max(1, Number(budget.maxChars || 1)), source: String(budget.source || '') } : null,
    hold: Boolean(snapshot.batchState?.hold),
    autoSubmit: snapshot.batchState?.autoSubmit !== false,
    sequencePreserved: [active, next].filter(Boolean).every(batch => batch.sequences.every((seq, index, list) => index === 0 || list[index - 1] <= seq))
  };
}
