export function buildVisualPreferenceProof({ width = 0, height = 0, scrollWidth = 0, clientWidth = 0, preferences = {}, media = {}, controlsVisible = 0, dialogs = 0 } = {}) {
  const reflow = Math.max(0, Number(scrollWidth || 0)) <= Math.max(0, Number(clientWidth || width || 0));
  const narrow = Number(width || 0) <= 320;
  const tiny = Number(width || 0) <= 280;
  return {
    viewport: { width: Number(width || 0), height: Number(height || 0), narrow, tiny },
    reflow,
    overflowPx: Math.max(0, Number(scrollWidth || 0) - Number(clientWidth || width || 0)),
    preferences: { reducedMotion: String(preferences.reducedMotion || 'system'), textScale: String(preferences.textScale || 'normal'), contrast: String(preferences.contrast || 'normal') },
    media: { print: Boolean(media.print), reducedMotion: Boolean(media.reducedMotion), highContrast: Boolean(media.highContrast) },
    controlsVisible: Math.max(0, Number(controlsVisible || 0)),
    dialogs: Math.max(0, Number(dialogs || 0)),
    ok: reflow && Number(controlsVisible || 0) > 0
  };
}

export function compareVisualPreferenceProofs(proofs = []) {
  const list = Array.isArray(proofs) ? proofs : [];
  const failures = list.filter(item => !item?.ok).map(item => ({ viewport: item.viewport, overflowPx: item.overflowPx }));
  return { ok: list.length > 0 && failures.length === 0, count: list.length, failures, widths: list.map(item => item.viewport?.width || 0) };
}
