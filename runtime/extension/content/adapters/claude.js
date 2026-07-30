import {
  firstMatch,
  firstInteractiveMatch,
  firstVisibleMatch,
  latestText,
  setEditableText,
  composerText,
  firstNonEmptyCandidate,
  clickFirst,
  submitWithEnter,
  createConversationMessageReader
} from './shared.js';

const COMPOSER_SELECTORS = [
  'div[contenteditable="true"].ProseMirror',
  '[contenteditable="true"][data-testid="chat-input"]',
  'div[contenteditable="true"][role="textbox"]',
  'div.ProseMirror[contenteditable="true"]'
];
const SEND_SELECTORS = [
  'button[aria-label="Send message"]',
  'button[data-testid="send-button"]',
  'button[aria-label^="Send"]'
];
const STOP_SELECTORS = [
  'button[aria-label="Stop response"]',
  'button[aria-label="Stop generating"]',
  'button[data-testid="stop-button"]',
  'button[aria-label^="Stop"]'
];
const VOICE_SELECTORS = [
  'button[aria-label="Use voice mode"]',
  'button[aria-label="Start voice mode"]',
  'button[aria-label="Start voice"]',
  'button[aria-label*="voice mode" i]',
  'button[aria-label*="microphone" i]'
];
const MUTE_SELECTORS = [
  'button[aria-label="Mute microphone"]',
  'button[aria-label="Unmute microphone"]',
  'button[aria-label*="mute" i]'
];
const ACTIVE_VOICE_SELECTORS = [
  'button[aria-label="End voice mode"]',
  'button[aria-label="End voice"]',
  'button[aria-label="Turn off microphone"]',
  'button[aria-label="Turn on microphone"]',
  'button[aria-label^="Release to" i]',
  'button[aria-label*="recording" i]',
  '[data-state="recording"]',
  '[aria-pressed="true"][aria-label*="record" i]',
  ...MUTE_SELECTORS
];
const OBSERVATION_ROOT_SELECTORS = [
  '[role="feed"][aria-label="Chat messages"]',
  'div[role="main"]',
  'main',
  '[role="main"]'
];
const USER_SELECTORS = [
  '[data-testid="user-message"]',
  '[data-testid*="user-message"]',
  '[data-author="user"]',
  '[data-message-author-role="user"]'
];
const ASSISTANT_SELECTORS = [
  '[data-testid="assistant-message"]',
  '[data-testid*="assistant-message"]',
  '[data-author="assistant"]',
  '[data-message-author-role="assistant"]',
  '.font-claude-message'
];
const MESSAGE_SELECTOR = '[data-testid="user-message"],[data-testid="assistant-message"],[data-author="user"],[data-author="assistant"],[data-message-author-role="user"],[data-message-author-role="assistant"],[role="article"]';
const SAFE_BLOCKING_DIALOG_PATTERNS = [
  /create files and artifacts/i,
  /claude can do more than answer questions/i
];
const DIALOG_CLOSE_SELECTORS = [
  'button[aria-label="Close"]',
  'button[title="Close"]',
  'button[data-testid="modal-close"]'
];

function dismissKnownBlockingDialog(doc) {
  const dialogs = Array.from(doc.querySelectorAll?.('[role="dialog"]') || []);
  for (const dialog of dialogs) {
    const text = composerText(dialog);
    if (!SAFE_BLOCKING_DIALOG_PATTERNS.some(pattern => pattern.test(text))) continue;
    let close = null;
    for (const selector of DIALOG_CLOSE_SELECTORS) {
      close = dialog.querySelector?.(selector) || null;
      if (close) break;
    }
    if (!close) {
      close = Array.from(dialog.querySelectorAll?.('button') || []).find(button => {
        const label = String(
          button.getAttribute?.('aria-label')
          || button.getAttribute?.('title')
          || composerText(button)
          || ''
        ).trim();
        return /^close$/i.test(label);
      }) || null;
    }
    if (!close || close.disabled) return false;
    close.click?.();
    return true;
  }
  return false;
}

const STREAMING_SELECTORS = [
  '[data-testid="assistant-message"][data-is-streaming="true"]',
  '[data-testid*="assistant-message"][data-is-streaming="true"]',
  '[data-author="assistant"][data-is-streaming="true"]',
  '.font-claude-message[data-is-streaming="true"]'
];

function articleRole(text) {
  if (/^You said:\s*/i.test(text)) return 'user';
  if (/^Claude responded:\s*/i.test(text)) return 'assistant';
  return '';
}

function compactSentence(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function stripCompactAccessibilityEcho(text) {
  const match = String(text || '').match(/^([a-z0-9]{12,})[.!?]\s+([\s\S]+)$/i);
  if (!match) return text;
  const compactEcho = compactSentence(match[1]);
  const visibleText = match[2].trim();
  return compactSentence(visibleText).startsWith(compactEcho) ? visibleText : text;
}

function collapseCapturedDuplicate(text) {
  const midpoint = Math.floor(text.length / 2);
  const left = text.slice(0, midpoint).trim();
  const right = text.slice(midpoint).trim();
  if (left && left === right) return left;
  const repeated = text.replace(/^(.+?[.!?])\s+\1(?:\s+|$)/, '$1 ');
  const parts = repeated.match(/^(.+?[.!?])\s+(.+?[.!?])(?:\s+|$)([\s\S]*)$/);
  if (parts && compactSentence(parts[1]) === compactSentence(parts[2])) {
    return `${parts[2]} ${parts[3]}`.trim();
  }
  return repeated;
}

function articleText(element) {
  let text = composerText(element).replace(/[\uE000-\uF8FF]/g, ' ').replace(/\s+/g, ' ').trim();
  text = text.replace(/^(?:You said:|Claude responded:)\s*/i, '');
  text = text.replace(/\s+\d{1,2}:\d{2}\s*(?:am|pm)\b.*$/i, '').trim();
  return collapseCapturedDuplicate(stripCompactAccessibilityEcho(text)).trim();
}

function hasCapturedStopControl(doc) {
  return Array.from(doc.querySelectorAll?.('button') || [])
    .some(button => composerText(button).toLowerCase() === 'stop');
}

export function createClaudeAdapter(doc = document) {
  const dismissBlockingUi = () => dismissKnownBlockingDialog(doc);
  const findComposer = () => {
    dismissBlockingUi();
    return firstInteractiveMatch(doc, COMPOSER_SELECTORS);
  };
  const findSendButton = () => firstVisibleMatch(doc, SEND_SELECTORS);
  const getComposerCandidate = () => firstNonEmptyCandidate(doc, COMPOSER_SELECTORS);
  const getConversationMessages = createConversationMessageReader(doc, {
    selector: MESSAGE_SELECTOR,
    roleOf(element) {
      const explicit = element.getAttribute?.('data-message-author-role')
        || element.getAttribute?.('data-author');
      if (explicit) return explicit;
      const testId = String(element.getAttribute?.('data-testid') || '').toLowerCase();
      if (testId.includes('user-message')) return 'user';
      if (testId.includes('assistant-message')) return 'assistant';
      return articleRole(composerText(element));
    },
    textOf(element) {
      return element.getAttribute?.('role') === 'article'
        ? articleText(element)
        : composerText(element);
    }
  });
  const latestRoleText = role => [...getConversationMessages()]
    .reverse()
    .find(message => message.role === role)?.text || '';
  const getLatestUserText = () => latestRoleText('user') || latestText(doc, USER_SELECTORS);

  return {
    provider: 'claude',
    dismissBlockingUi,
    findComposer,
    setComposerText(text) { return setEditableText(findComposer(), text); },
    composerContains(text) {
      return composerText(findComposer()) === String(text ?? '').trim();
    },
    isComposerEmpty() { return !composerText(findComposer()); },
    canSubmit() {
      const button = findSendButton();
      return Boolean(findComposer() && button && !button.disabled);
    },
    submit() {
      return clickFirst(doc, SEND_SELECTORS);
    },
    isGenerating() {
      return Boolean(firstMatch(doc, STOP_SELECTORS) || firstMatch(doc, STREAMING_SELECTORS));
    },
    stopGenerating() { return clickFirst(doc, STOP_SELECTORS); },
    getLatestUserText,
    getConversationMessages,
    getLatestAssistantText() {
      return latestRoleText('assistant') || latestText(doc, ASSISTANT_SELECTORS);
    },
    getSenderCandidateInfo() {
      const composer = getComposerCandidate();
      if (composer) return { text: composer.text, source: 'composer' };
      const userText = getLatestUserText();
      return userText ? { text: userText, source: 'user_message' } : { text: '', source: 'none' };
    },
    getSenderCandidate() { return this.getSenderCandidateInfo().text; },
    findVoiceButton() { return firstMatch(doc, VOICE_SELECTORS); },
    toggleMute() { return clickFirst(doc, MUTE_SELECTORS); },
    getObservationTargets() {
      const targets = [
        findComposer(),
        ...OBSERVATION_ROOT_SELECTORS.map(selector => firstMatch(doc, [selector]))
      ].filter(Boolean);
      return [...new Set(targets)];
    },
    isVoiceActive() {
      return Boolean(firstMatch(doc, ACTIVE_VOICE_SELECTORS) || hasCapturedStopControl(doc));
    }
  };
}
