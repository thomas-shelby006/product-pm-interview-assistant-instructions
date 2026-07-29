const TONES = {
  ok: ['#052e24', '#5eead4'],
  warn: ['#422006', '#fbbf24'],
  error: ['#450a0a', '#fca5a5'],
  info: ['#172554', '#93c5fd']
};

export function createStatusOverlay(doc, config, {
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout
} = {}) {
  const root = doc.createElement('div');
  root.id = 'pmia-runtime-status';
  root.setAttribute('aria-live', 'polite');
  root.style.cssText = [
    'position:fixed', 'top:12px', 'left:12px', 'z-index:2147483647',
    'padding:5px 10px', 'border-radius:999px', 'font:600 11px/1.2 ui-monospace,monospace',
    'pointer-events:none', 'box-shadow:0 2px 12px rgba(0,0,0,.35)',
    'max-width:360px', 'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis'
  ].join(';');
  (doc.body || doc.documentElement).appendChild(root);

  let timer = null;
  let stable = { text: 'STARTING', tone: 'info' };
  const prefix = `${config.role.toUpperCase()} · ${config.provider.toUpperCase()}`;

  function render(text, tone) {
    const [background, color] = TONES[tone] || TONES.info;
    root.textContent = `${prefix} · ${text}`;
    root.style.background = background;
    root.style.color = color;
    root.style.border = `1px solid ${color}66`;
    root.style.display = 'block';
  }

  function setStatus(text, tone = 'info', holdMs = 0) {
    clearTimeoutFn(timer);
    timer = null;
    if (holdMs <= 0) stable = { text, tone };
    render(text, tone);
    if (holdMs > 0) {
      timer = setTimeoutFn(() => {
        timer = null;
        render(stable.text, stable.tone);
      }, holdMs);
    }
  }

  setStatus('STARTING', 'info');
  return {
    element: root,
    setStatus,
    remove() { clearTimeoutFn(timer); root.remove(); }
  };
}
