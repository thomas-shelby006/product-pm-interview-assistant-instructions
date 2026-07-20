import {
  firstMatch, latestText, setEditableText, composerText, clickFirst, submitWithEnter
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
  'button[aria-label*="voice mode" i]',
  'button[aria-label*="microphone" i]'
];
const MUTE_SELECTORS = [
  'button[aria-label="Mute microphone"]',
  'button[aria-label="Unmute microphone"]',
  'button[aria-label*="mute" i]'
];
const USER_SELECTORS = [
  '[data-testid="user-message"]',
  '[data-testid*="user-message"]',
  '[data-author="user"]'
];
const ASSISTANT_SELECTORS = [
  '[data-is-streaming="false"]',
  '[data-testid="assistant-message"]',
  '[data-testid*="assistant-message"]',
  '.font-claude-message'
];

export function createClaudeAdapter(doc = document) {
  const findComposer = () => firstMatch(doc, COMPOSER_SELECTORS);
  return {
    provider: 'claude',
    findComposer,
    setComposerText(text) { return setEditableText(findComposer(), text); },
    submit() {
      if (clickFirst(doc, SEND_SELECTORS)) return true;
      return submitWithEnter(findComposer());
    },
    isGenerating() {
      return Boolean(firstMatch(doc, STOP_SELECTORS) || doc.querySelector('[data-is-streaming="true"]'));
    },
    stopGenerating() { return clickFirst(doc, STOP_SELECTORS); },
    getLatestUserText() { return latestText(doc, USER_SELECTORS); },
    getLatestAssistantText() { return latestText(doc, ASSISTANT_SELECTORS); },
    getSenderCandidate() {
      return this.getLatestUserText() || composerText(findComposer());
    },
    findVoiceButton() { return firstMatch(doc, VOICE_SELECTORS); },
    toggleMute() { return clickFirst(doc, MUTE_SELECTORS); }
  };
}
