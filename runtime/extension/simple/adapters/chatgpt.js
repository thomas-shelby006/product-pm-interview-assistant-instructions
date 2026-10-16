import { first, latest, nodeText, waitForDom, uniqueNodes } from '../dom.js';

const COMPOSER = ['#prompt-textarea','textarea[name="prompt-textarea"]','div[contenteditable="true"][role="textbox"]'];
const SEND = ['button[aria-label="Send prompt"]','button[data-testid="send-button"]','button[aria-label^="Send"]'];
const USER = ['section[data-turn="user"][data-turn-id]','[data-message-author-role="user"]','[data-message-role="user"]'];
const ASSISTANT = ['section[data-turn="assistant"]','[data-message-author-role="assistant"]','[data-message-role="assistant"]'];

function cleanUser(text) {
  return String(text || '').replace(/^\s*You said:\s*/i, '').trim();
}

export function createSimpleChatGptAdapter({ doc = document, writeInMain } = {}) {
  const composer = () => first(doc, COMPOSER);
  const send = () => first(doc, SEND);
  const matchingNodes = text => uniqueNodes(doc, USER).filter(node => cleanUser(nodeText(node)) === text);
  const readUserTurns = () => {
    const result = [];
    for (const node of uniqueNodes(doc, USER)) {
        const text = cleanUser(nodeText(node));
        if (!text) continue;
        const id = String(node.getAttribute?.('data-turn-id') || node.getAttribute?.('data-message-id') || node.id || '').trim();
        if (id && result.some(item => item.id === id)) continue;
        result.push({ id:id || `chatgpt-user-${result.length + 1}`, text });
    }
    return result;
  };
  return {
    provider:'chatgpt',
    isReady() { return Boolean(composer()); },
    async write(text) {
      if (typeof writeInMain !== 'function') return false;
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
      const form = composer()?.closest?.('form');
      if (typeof form?.requestSubmit !== 'function') return false;
      form.requestSubmit();
      return true;
    },
    renderedBaseline(text) { return new Set(matchingNodes(String(text ?? '').trim())); },
    verifyRenderedTurn(text, { baseline = new Set(), ...options } = {}) {
      const expected = String(text ?? '').trim();
      return waitForDom(() => matchingNodes(expected).some(node => !baseline.has(node)), { root:doc.documentElement, ...options });
    },
    readUserTurns,
    readLatestAssistantText() { return String(latest(doc, ASSISTANT)?.text || '').trim(); },
    readLatestUserTurn() {
      const hit = latest(doc, USER);
      if (!hit) return null;
      const id = String(hit.node?.getAttribute?.('data-turn-id') || hit.node?.id || '').trim();
      return { id, text: cleanUser(hit.text) };
    }
  };
}
