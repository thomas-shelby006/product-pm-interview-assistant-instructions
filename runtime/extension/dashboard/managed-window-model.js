export function deriveManagedWindowModel(snapshot = {}) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const layout = source.layout || {};
  const focus = String(layout.focusedRole || '');
  const mode = String(layout.mode || 'three_window');
  return {
    mode,
    focusedRole: focus,
    canGoBack: Array.isArray(layout.history) && layout.history.length > 0,
    hidden: Boolean(layout.hidden),
    targets: ['sender','receiver','pilot'].map(target => ({ target, focused: focus === target, label: target === 'pilot' ? 'Runtime Pilot' : target === 'sender' ? 'Window 1' : 'Window 2' })),
    description: mode === 'dashboard_only' ? 'Pilot spotlight'
      : mode === 'sender_dashboard' ? 'Window 1 spotlight'
      : mode === 'receiver_dashboard' ? 'Window 2 spotlight' : 'Three-window layout'
  };
}
