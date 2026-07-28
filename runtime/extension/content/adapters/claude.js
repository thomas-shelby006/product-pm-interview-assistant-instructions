import {
  firstMatch,
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
  ...MUTE_SELECTORS
];
const OBSERVATION_ROOT_SELECTORS = ['main', '[role="main"]'];
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
const MESSAGE_SELECTOR = '[data-testid="user-message"],[data-testid="assistant-message"],[data-author="user"],[data-author="assistant"],[data-message-author-role="user"],[data-message-author-role="assistant"]';
const STREAMING_SELECTORS = [
  '[data-testid="assistant-message"][data-is-streaming="true"]',
  '[data-testid*="assistant-message"][data-is-streaming="true"]',
  '[data-author="assistant"][data-is-streaming="true"]',
  '.font-claude-message[data-is-streaming="true"]'
];

export function createClaudeAdapter(doc = document) {
  const findComposer = () => firstMatch(doc, COMPOSER_SELECTORS);
  const findSendButton = () => firstMatch(doc, SEND_SELECTORS);
  const getComposerCandidate = () => firstNonEmptyCandidate(doc, COMPOSER_SELECTORS);
  const getLatestUserText = () => latestText(doc, USER_SELECTORS);
  const getConversationMessages = createConversationMessageReader(doc, {
    selector: MESSAGE_SELECTOR,
    roleOf(element) {
      const explicit = element.getAttribute?.('data-message-author-role')
        || element.getAttribute?.('data-author');
      if (explicit) return explicit;
      const testId = String(element.getAttribute?.('data-testid') || '').toLowerCase();
      if (testId.includes('user-message')) return 'user';
      if (testId.includes('assistant-message')) return 'assistant';
      return '';
    }
  });

  return {
    provider: 'claude',
    findComposer,
    setComposerText(text) { return setEditableText(findComposer(), text); },
    composerContains(text) {
      return composerText(findComposer()) === String(text ?? '').trim();
    },
    canSubmit() {
      const button = findSendButton();
      return Boolean(findComposer() && (!button || !button.disabled));
    },
    submit() {
      if (clickFirst(doc, SEND_SELECTORS)) return true;
      return submitWithEnter(findComposer());
    },
    isGenerating() {
      return Boolean(firstMatch(doc, STOP_SELECTORS) || firstMatch(doc, STREAMING_SELECTORS));
    },
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
