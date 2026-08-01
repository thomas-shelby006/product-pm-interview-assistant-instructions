function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }

export function normalizeDisplayBounds(value = {}) {
  return { left: Number(value.left || 0), top: Number(value.top || 0), width: Math.max(320, Number(value.width || 1920)), height: Math.max(240, Number(value.height || 1080)) };
}

export function restoreWindowBounds(saved = {}, display = {}) {
  const screen = normalizeDisplayBounds(display);
  const width = clamp(saved.width || 640, 320, screen.width);
  const height = clamp(saved.height || 720, 240, screen.height);
  const left = clamp(saved.left, screen.left, screen.left + screen.width - width);
  const top = clamp(saved.top, screen.top, screen.top + screen.height - height);
  return { left, top, width, height, focused: false, state: 'normal' };
}

export function restoreManagedLayout(layout = {}, displays = []) {
  const primary = normalizeDisplayBounds(displays[0] || {});
  const roles = ['sender','receiver','pilot'];
  const windows = {};
  for (const role of roles) windows[role] = restoreWindowBounds(layout.windows?.[role] || {}, primary);
  return { mode: String(layout.mode || 'three_window'), focusedRole: '', hidden: false, windows, restoredAt: Date.now() };
}
