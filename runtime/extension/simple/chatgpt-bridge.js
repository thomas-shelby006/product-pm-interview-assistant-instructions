export const CHATGPT_WRITE_REQUEST = 'pmia-simple:chatgpt-write';
export const CHATGPT_WRITE_RESPONSE = 'pmia-simple:chatgpt-write-result';

let sequence = 0;

export function createChatGptWriteBridge(target = window) {
  return {
    write(text, { timeoutMs = 500 } = {}) {
      const requestId = `gw-${++sequence}`;
      return new Promise(resolve => {
        const listener = event => {
          if (String(event?.detail?.requestId || '') !== requestId) return;
          clearTimeout(timer);
          target.removeEventListener(CHATGPT_WRITE_RESPONSE, listener);
          resolve({ ok:Boolean(event.detail.ok), matches:Boolean(event.detail.matches) });
        };
        const timer = setTimeout(() => {
          target.removeEventListener(CHATGPT_WRITE_RESPONSE, listener);
          resolve({ ok:false, reason:'bridge_timeout' });
        }, timeoutMs);
        target.addEventListener(CHATGPT_WRITE_RESPONSE, listener);
        target.dispatchEvent(new CustomEvent(CHATGPT_WRITE_REQUEST, {
          detail:{ requestId, text:String(text ?? '').slice(0, 32_000) }
        }));
      });
    }
  };
}
