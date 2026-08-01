const ESSENTIAL_SELECTORS = Object.freeze([
  '.topbar', '.session-strip', '.readiness-gate', '.policy-banner', '.live-session-console',
  '.truth-rail', '.live-state-card', '.current-answer-panel', '.next-draft-panel', '.attention-panel', '.footer'
]);

export function deriveFocusMode(snapshot = {}, preference = null) {
  const enabled = preference === null ? Boolean(snapshot.liveSession?.focusMode) : Boolean(preference);
  const phase = String(snapshot.liveSession?.phase || 'setup');
  return {
    enabled,
    phase,
    compact: enabled && ['active', 'paused'].includes(phase),
    essentialSelectors: [...ESSENTIAL_SELECTORS],
    label: enabled ? 'Exit Focus mode' : 'Enter Focus mode'
  };
}

export function applyFocusMode(document, value = {}) {
  const enabled = Boolean(value.enabled);
  document.body.dataset.focusMode = enabled ? 'true' : 'false';
  const toggle = document.getElementById('focusModeAction');
  if (toggle) {
    toggle.textContent = value.label || (enabled ? 'Exit Focus mode' : 'Enter Focus mode');
    toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }
  return enabled;
}
