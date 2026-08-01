const LABELS = Object.freeze({
  persisted: 'Waiting', submitting: 'Submitting', submitted: 'Submitted', proven: 'Delivered',
  failed: 'Needs attention', archived: 'Archived'
});

export function deriveQuestionStatus(entry = {}, snapshot = {}) {
  const state = String(entry.state || 'persisted');
  const activeIds = new Set(snapshot.batchState?.active?.memberIds || []);
  const nextIds = new Set(snapshot.batchState?.next?.memberIds || []);
  const active = activeIds.has(entry.id);
  const staged = nextIds.has(entry.id);
  const group = state === 'archived' ? 'archived'
    : state === 'proven' ? 'proven'
      : active || ['submitting', 'submitted'].includes(state) ? 'current'
        : 'waiting';
  return {
    state,
    label: active ? 'Current answer' : staged ? 'Next batch' : LABELS[state] || state.replaceAll('_', ' '),
    group,
    active,
    staged,
    actionable: ['persisted', 'failed'].includes(state)
  };
}
