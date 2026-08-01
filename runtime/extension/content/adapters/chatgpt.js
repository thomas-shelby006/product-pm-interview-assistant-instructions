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
  'textarea[name="prompt-textarea"]',
  '#prompt-textarea',
  'textarea[aria-label="Chat with ChatGPT"]',
  'div[contenteditable="true"][role="textbox"]'
];
const SEND_SELECTORS = [
  'button[aria-label="Send prompt"]',
  'button[data-testid="send-button"]',
  'button[aria-label^="Send"]'
];
const STOP_SELECTORS = [
  'button[aria-label="Stop streaming"]',
  'button[aria-label="Stop generating"]',
  'button[aria-label="Stop answering"]',
  'button[data-testid="stop-button"]'
];
const VOICE_SELECTORS = [
  'button[aria-label="Start Voice"]',
  'button[aria-label="Start voice mode"]',
  'button[aria-label="Start dictation"]',
  'button[aria-label*="voice mode" i]'
];
const MUTE_SELECTORS = [
  'button[aria-label="Turn off microphone"]',
  'button[aria-label="Turn on microphone"]',
  'button[aria-label="Mute microphone"]',
  'button[aria-label="Unmute microphone"]',
  'button[aria-label*="mute" i]'
];
const ACTIVE_VOICE_SELECTORS = [
  'button[aria-label="End Voice"]',
  'button[aria-label="End voice mode"]',
  ...MUTE_SELECTORS
];
const OBSERVATION_ROOT_SELECTORS = [
  '[data-conversation-transcript]',
  'main',
  '[role="main"]'
];
const LEGACY_USER_SELECTOR = '[data-message-author-role="user"]';
const LEGACY_ASSISTANT_SELECTOR = '[data-message-author-role="assistant"]';
const COMPACT_USER_SELECTOR = '[data-conversation-transcript] [data-message-role="user"]';
const COMPACT_ASSISTANT_SELECTOR = '[data-conversation-transcript] [data-message-role="assistant"]';
const MESSAGE_SELECTOR = [
  LEGACY_USER_SELECTOR,
  LEGACY_ASSISTANT_SELECTOR,
  COMPACT_USER_SELECTOR,
  COMPACT_ASSISTANT_SELECTOR
].join(',');

function messageRole(element) {
  return String(
    element?.getAttribute?.('data-message-author-role')
    || element?.getAttribute?.('data-message-role')
    || ''
  ).trim().toLowerCase();
}

function isMessageChrome(element) {
  return Boolean(
    element?.getAttribute?.('data-message-attribution') !== null
    || element?.getAttribute?.('data-message-actions') !== null
    || element?.getAttribute?.('data-assistant-message-actions') !== null
    || element?.getAttribute?.('data-conversation-inline-beacon-slot') !== null
  );
}

function compactMessageText(element) {
  const preferred = [
    '[data-user-message-copy]',
    '[data-user-message-bubble]',
    '[data-submit-message-animation-target]'
  ];
  for (const selector of preferred) {
    const candidate = element?.querySelector?.(selector);
    const text = composerText(candidate);
    if (text) return text;
  }

  const candidates = Array.from(element?.children || [])
    .filter(child => !isMessageChrome(child))
    .map(child => composerText(child))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  return candidates[0] || composerText(element);
}

function messageText(element) {
  if (element?.getAttribute?.('data-message-role')) return compactMessageText(element);
  return composerText(element);
}

export function createChatGptAdapter(doc = document) {
  const findComposer = () => firstInteractiveMatch(doc, COMPOSER_SELECTORS);
  const findSendButton = () => firstVisibleMatch(doc, SEND_SELECTORS);
  const getComposerCandidate = () => firstNonEmptyCandidate(doc, COMPOSER_SELECTORS);
  const getConversationMessages = createConversationMessageReader(doc, {
    selector: MESSAGE_SELECTOR,
    roleOf: messageRole,
    textOf: messageText
  });
  const latestRoleText = role => {
    const fromConversation = [...getConversationMessages()]
      .reverse()
      .find(message => message.role === role)?.text || '';
    if (fromConversation) return fromConversation;
    return latestText(doc, role === 'user'
      ? [LEGACY_USER_SELECTOR, COMPACT_USER_SELECTOR]
      : [LEGACY_ASSISTANT_SELECTOR, COMPACT_ASSISTANT_SELECTOR]);
  };
  const getLatestUserText = () => latestRoleText('user');

  return {
    provider: 'chatgpt',
    dismissBlockingUi() { return false; },
    findComposer,
    setComposerText(text) { return setEditableText(findComposer(), text); },
    getComposerText() { return composerText(findComposer()); },
    composerContains(text) {
      return composerText(findComposer()) === String(text ?? '').trim();
    },
    isComposerEmpty() { return !composerText(findComposer()); },
    canSubmit() {
      const button = findSendButton();
      return Boolean(findComposer() && button && !button.disabled);
    },
    submit() {
      if (clickFirst(doc, SEND_SELECTORS)) return true;
      return submitWithEnter(findComposer());
    },
    isGenerating() { return Boolean(firstMatch(doc, STOP_SELECTORS)); },
    stopGenerating() { return clickFirst(doc, STOP_SELECTORS); },
    getLatestUserText,
    getConversationMessages,
    getLatestAssistantText() { return latestRoleText('assistant'); },
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
      return [findComposer(), firstMatch(doc, OBSERVATION_ROOT_SELECTORS)].filter(Boolean);
    },
    isVoiceActive() { return Boolean(firstMatch(doc, ACTIVE_VOICE_SELECTORS)); }
  };
}
