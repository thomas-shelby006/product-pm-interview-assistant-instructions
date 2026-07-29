(() => {
  const version = chrome.runtime.getManifest().version;
  const fatalUrl = chrome.runtime.getURL('content/runtime-fatal.js');
  const entryUrl = chrome.runtime.getURL('content/entry.js');

  const renderFallbackFatal = error => {
    const root = document.getElementById('pmia-runtime-fatal') || document.createElement('div');
    root.id = 'pmia-runtime-fatal';
    root.setAttribute('role', 'alert');
    root.setAttribute('aria-live', 'assertive');
    root.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483647;padding:8px 12px;border-radius:8px;font:700 12px/1.35 ui-monospace,monospace;background:#450a0a;color:#fecaca;border:1px solid #fca5a5;box-shadow:0 2px 14px rgba(0,0,0,.45);max-width:520px';
    root.textContent = `PMIA ${version} · RUNTIME LOAD FAILED · ${String(error?.name || 'Error')} · Reload the extension, then reload this tab.`;
    if (!root.parentNode) (document.body || document.documentElement).appendChild(root);
  };

  import(fatalUrl)
    .then(({ renderRuntimeFatal }) => import(entryUrl).catch(error => {
      console.error('[PMIA] content runtime failed to load', error);
      renderRuntimeFatal(document, { stage: 'load', error, version });
    }))
    .catch(error => {
      console.error('[PMIA] fatal diagnostic module failed to load', error);
      renderFallbackFatal(error);
    });
})();