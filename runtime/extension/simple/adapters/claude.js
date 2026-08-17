import { first, latest, nodeText, waitForDom } from '../dom.js';

const COMPOSER = ['div[contenteditable="true"].ProseMirror','[contenteditable="true"][data-testid="chat-input"]'];
const SEND = ['button[aria-label="Send message"]','button[data-testid="send-button"]','button[aria-label^="Send"]'];
const USER = ['[data-testid="user-message"]','[data-testid*="user-message"]','[data-author="user"]','[data-message-author-role="user"]'];
const ASSISTANT = ['[data-testid="assistant-message"]','[data-testid*="assistant-message"]','[data-author="assistant"]','[data-message-author-role="assistant"]','.font-claude-message'];

export function createSimpleClaudeAdapter({ doc = document, writeInMain } = {}) {
  if (typeof writeInMain !== 'function') throw new TypeError('writeInMain is required');
  const composer = () => first(doc, COMPOSER);
  const send = () => first(doc, SEND);
  const cleanUser = value => String(value || '').replace(/^\s*You said:\s*/i, '').trim();
  const renderedUserText = () => cleanUser(latest(doc, USER)?.text || '');
  const readUserTurns = () => {
    const result = [];
    for (const selector of USER) {
      for (const node of Array.from(doc?.querySelectorAll?.(selector) || [])) {
        const text = cleanUser(nodeText(node));
        if (!text) continue;
        const id = String(node.getAttribute?.('data-message-id') || node.id || '').trim();
        result.push({ id:id || `claude-user-${result.length + 1}`, text });
      }
    }
    return result;
  };
  return {
    provider:'claude',
    isReady() { return Boolean(composer()); },
    async write(text) {
      const response = await writeInMain(String(text ?? '').trim());
      return Boolean(response?.ok && response?.matches !== false);
    },
    verifyComposer(text) { return nodeText(composer()) === String(text ?? '').trim(); },
    submit() {
      const button = send();
      if (button) {
        if (button.disabled) return false;
        button.click?.();
        return true;
      }
      const node = composer();
      const Keyboard = doc?.defaultView?.KeyboardEvent || globalThis.KeyboardEvent;
      if (!node || typeof Keyboard !== 'function' || typeof node.dispatchEvent !== 'function') return false;
      node.focus?.();
      if (doc?.activeElement && doc.activeElement !== node) return false;
      const event = new Keyboard('keydown', { key:'Enter', code:'Enter', bubbles:true, cancelable:true });
      node.dispatchEvent(event);
      return true;
    },
    verifyRenderedTurn(text, options) {
      const expected = String(text ?? '').trim();
      return waitForDom(() => renderedUserText() === expected, { root:doc.documentElement, ...options });
    },
    readUserTurns,
    readLatestAssistantText() { return String(latest(doc, ASSISTANT)?.text || '').trim(); },
    readLatestUserTurn() {
      const hit = latest(doc, USER);
      return hit ? { id:String(hit.node?.id || ''), text:String(hit.text || '').trim() } : null;
    }
  };
}
