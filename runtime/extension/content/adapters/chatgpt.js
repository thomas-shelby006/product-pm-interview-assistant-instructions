import {
  firstMatch, latestText, setEditableText, composerText, clickFirst, submitWithEnter
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
  'button[data-testid="stop-button"]'
];
const VOICE_SELECTORS = [
  'button[aria-label="Start dictation"]',
  'button[aria-label="Start voice mode"]',
  'button[aria-label*="voice mode" i]'
];
const MUTE_SELECTORS = [
  'button[aria-label="Mute microphone"]',
  'button[aria-label="Unmute microphone"]',
  'button[aria-label*="mute" i]'
];

export function createChatGptAdapter(doc = document) {
  const findComposer = () => firstMatch(doc, COMPOSER_SELECTORS);
  return {
    provider: 'chatgpt',
    findComposer,
    setComposerText(text) { return setEditableText(findComposer(), text); },
    submit() {
      if (clickFirst(doc, SEND_SELECTORS)) return true;
      return submitWithEnter(findComposer());
    },
    isGenerating() { return Boolean(firstMatch(doc, STOP_SELECTORS)); },
    stopGenerating() { return clickFirst(doc, STOP_SELECTORS); },
    getLatestUserText() {
      return latestText(doc, ['[data-message-author-role="user"]']);
    },
    getLatestAssistantText() {
      return latestText(doc, ['[data-message-author-role="assistant"]']);
    },
    getSenderCandidate() {
      return this.getLatestUserText() || composerText(findComposer());
    },
    findVoiceButton() { return firstMatch(doc, VOICE_SELECTORS); },
    toggleMute() { return clickFirst(doc, MUTE_SELECTORS); }
  };
}
