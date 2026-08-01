const CATALOG = Object.freeze([
  { id: 'pause', label: 'Pause forwarding', group: 'Delivery', shortcut: 'Space', risk: 'safe' },
  { id: 'resume_catch_up', label: 'Resume and catch up', group: 'Delivery', shortcut: 'L', risk: 'safe' },
  { id: 'submit_now', label: 'Submit next batch now', group: 'Delivery', shortcut: 'N', risk: 'caution', requires: 'next_batch' },
  { id: 'interrupt_latest', label: 'Interrupt for latest question', group: 'Delivery', shortcut: 'I', risk: 'destructive', requires: 'waiting_final' },
  { id: 'check_live', label: 'Check live health', group: 'Recovery', shortcut: 'H', risk: 'safe' },
  { id: 'run_self_test', label: 'Run active self-test', group: 'Recovery', risk: 'safe' },
  { id: 'repair_runtime', label: 'Repair runtime', group: 'Recovery', shortcut: 'R', risk: 'caution' },
  { id: 'stabilize_runtime', label: 'Stabilize runtime', group: 'Recovery', risk: 'safe' },
  { id: 'run_transport_drill', label: 'Run transport drill', group: 'Verification', risk: 'safe' },
  { id: 'focus_sender', label: 'Focus Window 1', group: 'Navigate', risk: 'safe' },
  { id: 'focus_receiver', label: 'Focus Window 2', group: 'Navigate', risk: 'safe' },
  { id: 'focus_pilot', label: 'Focus Runtime Pilot', group: 'Navigate', risk: 'safe' },
  { id: 'focus_back', label: 'Back to previous managed view', group: 'Navigate', risk: 'safe' },
  { id: 'spotlight_sender', label: 'Spotlight Window 1', group: 'Navigate', risk: 'safe' },
  { id: 'spotlight_receiver', label: 'Spotlight Window 2', group: 'Navigate', risk: 'safe' },
  { id: 'spotlight_pilot', label: 'Spotlight Runtime Pilot', group: 'Navigate', risk: 'safe' },
  { id: 'export_support_bundle', label: 'Download support bundle', group: 'Review', risk: 'safe' },
  { id: 'create_checkpoint', label: 'Create session checkpoint', group: 'Review', risk: 'safe' },
  { id: 'prepare_end_session', label: 'Prepare end session', group: 'Session', risk: 'caution' }
]);

export function commandCatalog(snapshot = {}) {
  const nextCount = Number(snapshot.batchState?.next?.questionCount || snapshot.batchState?.next?.memberIds?.length || 0);
  const unresolved = Number(snapshot.ledgerCounts?.persisted || 0) + Number(snapshot.ledgerCounts?.failed || 0);
  return CATALOG.map(item => ({
    ...item,
    available: item.requires === 'next_batch' ? nextCount > 0
      : item.requires === 'waiting_final' ? unresolved > 0
      : snapshot.mode !== 'ended',
    blockedReason: snapshot.mode === 'ended' ? 'session_ended'
      : item.requires === 'next_batch' && !nextCount ? 'next_batch_empty'
      : item.requires === 'waiting_final' && !unresolved ? 'no_waiting_final' : ''
  }));
}

export function searchCommands(catalog = CATALOG, query = '') {
  const words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return catalog.map((item, index) => {
    const haystack = `${item.label} ${item.id} ${item.group} ${item.shortcut || ''}`.toLowerCase();
    const score = words.reduce((sum, word) => sum + (haystack.startsWith(word) ? 8 : haystack.includes(word) ? 3 : -20), 0) - index / 100;
    return { ...item, score };
  }).filter(item => !words.length || item.score >= 0).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

export function commandPreview(command = {}, snapshot = {}) {
  return {
    id: String(command.id || ''), label: String(command.label || ''), risk: String(command.risk || 'safe'),
    available: command.available !== false, blockedReason: String(command.blockedReason || ''),
    mode: String(snapshot.mode || 'unknown'), unresolved: Number(snapshot.ledger?.filter?.(item => !['proven', 'archived'].includes(item.state)).length || 0)
  };
}
