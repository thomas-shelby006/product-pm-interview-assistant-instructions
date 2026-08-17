export const CHATGPT_WRITE_REQUEST = 'pmia-simple:chatgpt-write';
export const CHATGPT_WRITE_RESPONSE = 'pmia-simple:chatgpt-write-result';

let sequence = 0;

function request(target, detail, { timeoutMs = 500 } = {}) {
  const requestId = `gw-${++sequence}`;
  return new Promise(resolve => {
    const listener = event => {
      if (String(event?.detail?.requestId || '') !== requestId) return;
      clearTimeout(timer);
      target.removeEventListener(CHATGPT_WRITE_RESPONSE, listener);
      resolve({
        ok:Boolean(event.detail.ok),
        matches:Boolean(event.detail.matches),
        cleared:Boolean(event.detail.cleared),
        reason:String(event.detail.reason || '')
      });
    };
    const timer = setTimeout(() => {
      target.removeEventListener(CHATGPT_WRITE_RESPONSE, listener);
      resolve({ ok:false, reason:'bridge_timeout' });
    }, timeoutMs);
    target.addEventListener(CHATGPT_WRITE_RESPONSE, listener);
    target.dispatchEvent(new CustomEvent(CHATGPT_WRITE_REQUEST, {
      detail:{ requestId, ...detail }
    }));
  });
}

export function createChatGptWriteBridge(target = window) {
  return {
    write(text, options) {
      return request(target, { text:String(text ?? '').slice(0, 32_000) }, options);
    },
    clearStaleSetup(prefix, options) {
      return request(target, { action:'clear_stale_setup', prefix:String(prefix ?? '').slice(0, 500) }, options);
    }
  };
}
