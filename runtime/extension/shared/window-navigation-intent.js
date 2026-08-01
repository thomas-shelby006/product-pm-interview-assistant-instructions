const TARGETS = new Set(['sender','receiver','pilot']);
const ACTIONS = new Set(['focus','spotlight','back']);

export function normalizeWindowNavigationIntent(value = {}) {
  const target = String(value.target || '');
  const action = String(value.action || 'focus');
  return {
    target: TARGETS.has(target) ? target : '',
    action: ACTIONS.has(action) ? action : '',
    focusIntent: value.focusIntent && typeof value.focusIntent === 'object' ? { ...value.focusIntent } : null
  };
}

export function navigationCommand(target, action = 'focus') {
  const normalized = normalizeWindowNavigationIntent({ target, action });
  if (!normalized.target || !normalized.action) return '';
  return normalized.action === 'back' ? 'focus_back' : `${normalized.action}_${normalized.target}`;
}
