const LABELS = { sender: 'Window 1 ready', receiver: 'Window 2 ready', adapters: 'Adapters complete', reconciliation: 'Ledger reconciled', batch: 'Batch state safe', storage: 'Storage safe' };

export function deriveRecoveryProgress(snapshot) {
  const repair = snapshot?.lastRepair || {};
  const checks = repair.checks || {};
  const items = Object.entries(LABELS).map(([id, label]) => ({ id, label, complete: checks[id] === true }));
  return {
    phase: String(repair.phase || (snapshot?.mode === 'active' ? 'healthy' : snapshot?.mode || 'idle')),
    verified: Boolean(repair.verified),
    complete: items.filter(item => item.complete).length,
    total: items.length,
    error: String(repair.error || ''),
    items
  };
}
