export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function normalizeDisplayPreferences(value) {
  const source = value && typeof value === 'object' ? value : {};
  return { largeText:Boolean(source.largeText), highContrast:Boolean(source.highContrast), reducedMotion:Boolean(source.reducedMotion) };
}

export function speakingLabel(metrics = {}) {
  const words = Math.max(0, Number(metrics.wordCount) || 0);
  if (!words) return 'No completed answer metric';
  const spoken = formatElapsed(metrics.estimatedSpeakingMs).replace(/^0(?=\d:)/, '');
  return `${words} words · ~${spoken} spoken`;
}

export function applyDisplayPreferences(root, value) {
  const next = normalizeDisplayPreferences(value);
  if (root?.dataset) {
    root.dataset.largeText = String(next.largeText);
    root.dataset.highContrast = String(next.highContrast);
    root.dataset.reducedMotion = String(next.reducedMotion);
  }
  return next;
}