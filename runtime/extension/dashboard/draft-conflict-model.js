export function deriveDraftConflict(snapshot) {
  const conflict = snapshot?.batchState?.draftConflict || null;
  if (!conflict) return { visible: false, state: 'clear', label: 'No conflict', owner: '', at: 0 };
  const state = String(conflict.state || 'unresolved');
  const label = state === 'unresolved' ? 'Action required'
    : state === 'keep_manual' ? 'Manual draft kept'
      : state === 'restore_pmia' ? 'PMIA draft restored'
        : state === 'merge' ? 'Drafts merged'
          : 'Resolved';
  return { visible: true, state, label, owner: String(conflict.owner || ''), at: Number(conflict.at || 0) };
}
