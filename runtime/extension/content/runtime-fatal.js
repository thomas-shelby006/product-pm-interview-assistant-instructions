const FATAL_ID = 'pmia-runtime-fatal';

function errorName(error) {
  const name = String(error?.name || 'Error').trim();
  return /^[A-Za-z][A-Za-z0-9]*Error$/.test(name) ? name : 'Error';
}

function stageLabel(stage) {
  return stage === 'load' ? 'RUNTIME LOAD FAILED' : 'RUNTIME START FAILED';
}

export function renderRuntimeFatal(doc, {
  stage = 'start',
  error = null,
  version = ''
} = {}) {
  if (!doc?.createElement) return null;
  let root = doc.getElementById?.(FATAL_ID) || null;
  if (!root) {
    root = doc.createElement('div');
    root.id = FATAL_ID;
    root.setAttribute('role', 'alert');
    root.setAttribute('aria-live', 'assertive');
    root.style.cssText = [
      'position:fixed', 'top:12px', 'left:12px', 'z-index:2147483647',
      'padding:8px 12px', 'border-radius:8px',
      'font:700 12px/1.35 ui-monospace,monospace',
      'background:#450a0a', 'color:#fecaca', 'border:1px solid #fca5a5',
      'box-shadow:0 2px 14px rgba(0,0,0,.45)', 'max-width:520px'
    ].join(';');
    (doc.body || doc.documentElement)?.appendChild(root);
  }

  const release = String(version || '').trim() || 'unknown';
  root.textContent = `PMIA ${release} · ${stageLabel(stage)} · ${errorName(error)} · Reload the extension, then reload this tab.`;
  return root;
}
