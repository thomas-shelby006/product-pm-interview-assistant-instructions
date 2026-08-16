export const CLAUDE_WRITE_REQUEST = 'pmia-simple:claude-write';
export const CLAUDE_WRITE_RESPONSE = 'pmia-simple:claude-write-result';

let sequence = 0;

export function createClaudeWriteBridge(target = window) {
  return {
    write(text, { timeoutMs = 500 } = {}) {
      const requestId = `cw-${++sequence}`;
      return new Promise(resolve => {
        const timer = setTimeout(() => {
          target.removeEventListener(CLAUDE_WRITE_RESPONSE, listener);
          resolve({ ok:false, reason:'bridge_timeout' });
        }, timeoutMs);
        const listener = event => {
          if (String(event?.detail?.requestId || '') !== requestId) return;
          clearTimeout(timer);
          target.removeEventListener(CLAUDE_WRITE_RESPONSE, listener);
          resolve({ ok:Boolean(event.detail.ok), matches:Boolean(event.detail.matches) });
        };
        target.addEventListener(CLAUDE_WRITE_RESPONSE, listener);
        target.dispatchEvent(new CustomEvent(CLAUDE_WRITE_REQUEST, {
          detail:{ requestId, text:String(text ?? '').slice(0, 32_000) }
        }));
      });
    }
  };
}
