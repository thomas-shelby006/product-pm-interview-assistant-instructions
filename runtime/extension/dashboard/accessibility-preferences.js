const MOTION = new Set(['system','on','off']);
const TEXT = new Set(['normal','large']);
const CONTRAST = new Set(['normal','high']);

export function normalizeAccessibilityPreferences(value = {}) {
  const reducedMotion = MOTION.has(String(value.reducedMotion)) ? String(value.reducedMotion) : (value.reducedMotion === true ? 'on' : 'system');
  const textScale = TEXT.has(String(value.textScale)) ? String(value.textScale) : (value.largeText ? 'large' : 'normal');
  const contrast = CONTRAST.has(String(value.contrast)) ? String(value.contrast) : (value.highContrast ? 'high' : 'normal');
  return {
    reducedMotion,
    textScale,
    contrast,
    compactDensity: Boolean(value.compactDensity),
    announcements: value.announcements !== false,
    largeText: textScale === 'large',
    highContrast: contrast === 'high'
  };
}

export function setAccessibilityPreference(current = {}, name, value) {
  if (!['reducedMotion','textScale','contrast'].includes(String(name || ''))) return { ok: false, error: 'accessibility_preference_unknown', preferences: normalizeAccessibilityPreferences(current) };
  const next = normalizeAccessibilityPreferences({ ...current, [name]: value });
  if (String(next[name]) !== String(value)) return { ok: false, error: 'accessibility_preference_invalid', preferences: normalizeAccessibilityPreferences(current) };
  return { ok: true, name, value: next[name], preferences: next };
}

export function applyAccessibilityPreferences(root, value = {}, matchMedia = globalThis.matchMedia) {
  const preferences = normalizeAccessibilityPreferences(value);
  const systemReduced = preferences.reducedMotion === 'system' && Boolean(matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  root.dataset.reducedMotion = String(preferences.reducedMotion === 'on' || systemReduced);
  root.dataset.textScale = preferences.textScale;
  root.dataset.contrast = preferences.contrast;
  return { ...preferences, effectiveReducedMotion: root.dataset.reducedMotion === 'true' };
}
