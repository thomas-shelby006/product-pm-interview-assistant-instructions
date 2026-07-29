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
const OBSERVATION_ROOT_SELECTORS = ['main', '[role="main"]'];
const USER_SELECTORS = ['[data-message-author-role="user"]'];
const ASSISTANT_SELECTORS = ['[data-message-author-role="assistant"]'];
const MESSAGE_SELECTOR = '[data-message-author-role="user"],[data-message-author-role="assistant"]';

export function createChatGptAdapter(doc = document) {
  const findComposer = () => firstInteractiveMatch(doc, COMPOSER_SELECTORS);
  const findSendButton = () => firstVisibleMatch(doc, SEND_SELECTORS);
  const getComposerCandidate = () => firstNonEmptyCandidate(doc, COMPOSER_SELECTORS);
  const getLatestUserText = () => latestText(doc, USER_SELECTORS);
  const getConversationMessages = createConversationMessageReader(doc, { selector: MESSAGE_SELECTOR });

  return {
    provider: 'chatgpt',
    findComposer,
    setComposerText(text) { return setEditableText(findComposer(), text); },
    composerContains(text) {
      return composerText(findComposer()) === String(text ?? '').trim();
    },
    isComposerEmpty() { return !composerText(findComposer()); },
    canSubmit() {
      const button = findSendButton();
      return Boolean(findComposer() && (!button || !button.disabled));
    },
    submit() {
      if (clickFirst(doc, SEND_SELECTORS)) return true;
      return submitWithEnter(findComposer());
    },
    isGenerating() { return Boolean(firstMatch(doc, STOP_SELECTORS)); },
    stopGenerating() { return clickFirst(doc, STOP_SELECTORS); },
    getLatestUserText,
    getConversationMessages,
    getLatestAssistantText() { return latestText(doc, ASSISTANT_SELECTORS); },
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
