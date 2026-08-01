import { composeBatchPrompt } from './batch-planner.js';

export const UNRESOLVED_LEDGER_STATES = new Set([
  'persisted',
  'staged',
  'submitting',
  'failed'
]);

export function unresolvedLedgerEntries(snapshot) {
  return (Array.isArray(snapshot?.ledger) ? snapshot.ledger : [])
    .filter(item => UNRESOLVED_LEDGER_STATES.has(item?.state))
    .sort((a, b) => (
      Number(a?.envelope?.seq || 0) - Number(b?.envelope?.seq || 0)
      || Number(a?.persistedAt || 0) - Number(b?.persistedAt || 0)
    ));
}

export function buildReconciliationPayload(snapshot) {
  const unresolved = unresolvedLedgerEntries(snapshot);
  const grouped = new Map();
  for (const item of unresolved) {
    const batchId = String(item.batchId || '');
    if (!batchId || batchId === 'next' || batchId.startsWith('single-')) continue;
    if (!grouped.has(batchId)) grouped.set(batchId, []);
    grouped.get(batchId).push(item);
  }
  const batches = [...grouped.entries()].map(([id, items]) => {
    const entries = items.map(item => ({ id: item.id, envelope: item.envelope }));
    return {
      id,
      memberIds: entries.map(entry => entry.id),
      prompt: composeBatchPrompt({ entries })
    };
  });
  return {
    batches,
    pending: unresolved.map(item => item.envelope).filter(Boolean)
  };
}
