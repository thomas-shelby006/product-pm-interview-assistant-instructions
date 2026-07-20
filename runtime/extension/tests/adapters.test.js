import test from 'node:test';
import assert from 'node:assert/strict';

const chatgptModule = await import('../content/adapters/chatgpt.js').catch(() => null);
const claudeModule = await import('../content/adapters/claude.js').catch(() => null);

function fakeElement(overrides = {}) {
  const events = [];
  return {
    tagName: 'DIV',
    value: '',
    textContent: '',
    innerText: '',
    disabled: false,
    clicked: false,
    focused: false,
    focus() { this.focused = true; },
    click() { this.clicked = true; },
    dispatchEvent(event) { events.push(event.type); return true; },
    get events() { return events; },
    ...overrides
  };
}

function fakeDocument(entries = {}, lists = {}) {
  return {
    querySelector(selector) { return entries[selector] || null; },
    querySelectorAll(selector) { return lists[selector] || []; }
  };
}

test('ChatGPT adapter uses captured textarea and Send prompt controls', () => {
  assert.ok(chatgptModule, 'ChatGPT adapter module must exist');
  const composer = fakeElement({ tagName: 'TEXTAREA' });
  const send = fakeElement({ tagName: 'BUTTON' });
  const doc = fakeDocument({
    'textarea[name="prompt-textarea"]': composer,
    'button[aria-label="Send prompt"]': send
  });
  const adapter = chatgptModule.createChatGptAdapter(doc);
  assert.equal(adapter.findComposer(), composer);
  adapter.setComposerText('question');
  assert.equal(composer.value, 'question');
  assert.equal(adapter.submit(), true);
  assert.equal(send.clicked, true);
});

test('ChatGPT adapter reads latest role-tagged messages', () => {
  assert.ok(chatgptModule, 'ChatGPT adapter module must exist');
  const user1 = fakeElement({ textContent: 'old' });
  const user2 = fakeElement({ textContent: 'latest user' });
  const assistant = fakeElement({ textContent: 'latest answer' });
  const doc = fakeDocument({}, {
    '[data-message-author-role="user"]': [user1, user2],
    '[data-message-author-role="assistant"]': [assistant]
  });
  const adapter = chatgptModule.createChatGptAdapter(doc);
  assert.equal(adapter.getLatestUserText(), 'latest user');
  assert.equal(adapter.getLatestAssistantText(), 'latest answer');
});

test('ChatGPT adapter detects and stops generation', () => {
  assert.ok(chatgptModule, 'ChatGPT adapter module must exist');
  const stop = fakeElement({ tagName: 'BUTTON' });
  const doc = fakeDocument({ 'button[aria-label="Stop streaming"]': stop });
  const adapter = chatgptModule.createChatGptAdapter(doc);
  assert.equal(adapter.isGenerating(), true);
  assert.equal(adapter.stopGenerating(), true);
  assert.equal(stop.clicked, true);
});

test('Claude adapter supports contenteditable composer and voice-mode evidence', () => {
  assert.ok(claudeModule, 'Claude adapter module must exist');
  const composer = fakeElement({ tagName: 'DIV' });
  const send = fakeElement({ tagName: 'BUTTON' });
  const voice = fakeElement({ tagName: 'BUTTON' });
  const doc = fakeDocument({
    'div[contenteditable="true"].ProseMirror': composer,
    'button[aria-label="Send message"]': send,
    'button[aria-label="Use voice mode"]': voice
  });
  const adapter = claudeModule.createClaudeAdapter(doc);
  assert.equal(adapter.findComposer(), composer);
  adapter.setComposerText('question');
  assert.equal(composer.textContent, 'question');
  assert.equal(adapter.submit(), true);
  assert.equal(send.clicked, true);
  assert.equal(adapter.findVoiceButton(), voice);
});

test('Claude adapter reads semantic user and assistant message containers', () => {
  assert.ok(claudeModule, 'Claude adapter module must exist');
  const user = fakeElement({ innerText: 'latest user' });
  const assistant = fakeElement({ innerText: 'latest answer' });
  const doc = fakeDocument({}, {
    '[data-testid="user-message"]': [user],
    '[data-is-streaming="false"]': [assistant]
  });
  const adapter = claudeModule.createClaudeAdapter(doc);
  assert.equal(adapter.getLatestUserText(), 'latest user');
  assert.equal(adapter.getLatestAssistantText(), 'latest answer');
});

test('provider adapters expose the same contract', () => {
  assert.ok(chatgptModule && claudeModule, 'provider modules must exist');
  const required = [
    'findComposer', 'setComposerText', 'submit', 'isGenerating',
    'stopGenerating', 'getLatestUserText', 'getLatestAssistantText',
    'getSenderCandidate', 'findVoiceButton'
  ];
  for (const factory of [chatgptModule.createChatGptAdapter, claudeModule.createClaudeAdapter]) {
    const adapter = factory(fakeDocument());
    for (const name of required) assert.equal(typeof adapter[name], 'function', name);
  }
});


test('provider adapters toggle captured microphone controls without coordinates', () => {
  assert.ok(chatgptModule && claudeModule, 'provider modules must exist');
  const chatMute = fakeElement({ tagName: 'BUTTON' });
  const claudeMute = fakeElement({ tagName: 'BUTTON' });
  const chat = chatgptModule.createChatGptAdapter(fakeDocument({
    'button[aria-label="Mute microphone"]': chatMute
  }));
  const claude = claudeModule.createClaudeAdapter(fakeDocument({
    'button[aria-label="Unmute microphone"]': claudeMute
  }));
  assert.equal(chat.toggleMute(), true);
  assert.equal(claude.toggleMute(), true);
  assert.equal(chatMute.clicked, true);
  assert.equal(claudeMute.clicked, true);
});
