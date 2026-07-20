(() => {
  const moduleUrl = chrome.runtime.getURL('content/entry.js');
  import(moduleUrl).catch(error => {
    console.error('[PMIA] content runtime failed to load', error);
  });
})();
