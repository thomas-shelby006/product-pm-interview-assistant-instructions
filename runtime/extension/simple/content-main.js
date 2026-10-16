(() => {
  const CONFIG_KEY = 'pmia_simple_config_v1';
  try {
    const url = new URL(location.href);
    const config = {
      sessionId:String(url.searchParams.get('pmia_session') || '').trim(),
      role:String(url.searchParams.get('pmia_role') || '').trim().toLowerCase(),
      provider:String(url.searchParams.get('pmia_provider') || '').trim().toLowerCase()
    };
    const validRole = ['sender','receiver','comparison'].includes(config.role);
    const validProvider = ['chatgpt','claude'].includes(config.provider);
    if (config.sessionId && validRole && validProvider) {
      sessionStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }
  } catch {}

  import(chrome.runtime.getURL('simple/browser-entry.js'))
    .then(module => module.startSimpleBrowserRuntime())
    .catch(error => {
      console.error('[PMIA Simple] runtime failed to load', error);
      document.documentElement.dataset.pmiaSimpleError = 'runtime_load_failed';
    });
})();
