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
    '[data-testid="assistant-message"]': [assistant]
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
    'getSenderCandidate', 'findVoiceButton', 'getObservationTargets', 'isVoiceActive'
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


test('ChatGPT sender candidate skips an empty shadow textarea for populated editor', () => {
  assert.ok(chatgptModule, 'ChatGPT adapter module must exist');
  const emptyTextarea = fakeElement({ tagName: 'TEXTAREA', value: '' });
  const populatedEditor = fakeElement({ tagName: 'DIV', textContent: 'What metric would you use?' });
  const doc = {
    querySelector(selector) {
      if (selector === 'textarea[name="prompt-textarea"]') return emptyTextarea;
      if (selector === 'div[contenteditable="true"][role="textbox"]') return populatedEditor;
      return null;
    },
    querySelectorAll(selector) {
      const match = this.querySelector(selector);
      return match ? [match] : [];
    }
  };
  const adapter = chatgptModule.createChatGptAdapter(doc);
  assert.equal(adapter.getSenderCandidate(), 'What metric would you use?');
});


test('sender candidate prefers populated composer over previous submitted turn', () => {
  const previousUser = fakeElement({ textContent: 'old submitted question' });
  const composer = fakeElement({ tagName: 'TEXTAREA', value: 'new dictated question' });
  const doc = fakeDocument({
    'textarea[name="prompt-textarea"]': composer
  }, {
    '[data-message-author-role="user"]': [previousUser],
    'textarea[name="prompt-textarea"]': [composer]
  });
  const adapter = chatgptModule.createChatGptAdapter(doc);
  assert.equal(adapter.getSenderCandidate(), 'new dictated question');
  assert.deepEqual(adapter.getSenderCandidateInfo(), {
    text: 'new dictated question', source: 'composer'
  });
});

test('ChatGPT adapter recognizes captured native voice controls', () => {
  const startVoice = fakeElement({ tagName: 'BUTTON' });
  const mic = fakeElement({ tagName: 'BUTTON' });
  const adapter = chatgptModule.createChatGptAdapter(fakeDocument({
    'button[aria-label="Start Voice"]': startVoice,
    'button[aria-label="Turn off microphone"]': mic
  }));
  assert.equal(adapter.findVoiceButton(), startVoice);
  assert.equal(adapter.toggleMute(), true);
  assert.equal(mic.clicked, true);
});

test('Claude assistant extraction ignores generic non-message streaming containers', () => {
  const unrelated = fakeElement({ innerText: 'settings panel text' });
  const assistant = fakeElement({ innerText: 'actual Claude answer' });
  const doc = fakeDocument({}, {
    '[data-is-streaming="false"]': [unrelated],
    '[data-testid="assistant-message"]': [assistant]
  });
  const adapter = claudeModule.createClaudeAdapter(doc);
  assert.equal(adapter.getLatestAssistantText(), 'actual Claude answer');
});

test('Claude sender candidate reports final submitted-turn source when composer is empty', () => {
  const user = fakeElement({ innerText: 'final voice transcript' });
  const composer = fakeElement({ tagName: 'DIV', textContent: '' });
  const doc = fakeDocument({
    'div[contenteditable="true"].ProseMirror': composer
  }, {
    '[data-testid="user-message"]': [user],
    'div[contenteditable="true"].ProseMirror': [composer]
  });
  const adapter = claudeModule.createClaudeAdapter(doc);
  assert.deepEqual(adapter.getSenderCandidateInfo(), {
    text: 'final voice transcript', source: 'user_message'
  });
});
function roleMessage({ id, role, text, turnId = '' }) {
  const attrs = {
    'data-message-id': id,
    'data-message-author-role': role,
    'data-turn-id': turnId
  };
  const turn = turnId ? { getAttribute: name => name === 'data-turn-id' ? turnId : '' } : null;
  return fakeElement({
    innerText: text,
    getAttribute(name) { return attrs[name] || ''; },
    closest(selector) { return selector.includes('data-turn-id') ? turn : null; }
  });
}

test('ChatGPT adapter returns ordered messages with captured stable identities', () => {
  const user = roleMessage({ id: 'u-1', role: 'user', text: 'Full question', turnId: 'turn-1' });
  const assistant = roleMessage({ id: 'a-1', role: 'assistant', text: 'Answer', turnId: 'turn-2' });
  const selector = '[data-message-author-role="user"],[data-message-author-role="assistant"]';
  const adapter = chatgptModule.createChatGptAdapter(fakeDocument({}, { [selector]: [user, assistant] }));
  assert.deepEqual(adapter.getConversationMessages().map(({ id, turnId, role, text }) => ({ id, turnId, role, text })), [
    { id: 'u-1', turnId: 'turn-1', role: 'user', text: 'Full question' },
    { id: 'a-1', turnId: 'turn-2', role: 'assistant', text: 'Answer' }
  ]);
});

test('Claude adapter returns ordered typed conversation messages', () => {
  const user = fakeElement({
    innerText: 'Typed Claude question',
    getAttribute(name) {
      if (name === 'data-testid') return 'user-message';
      if (name === 'data-message-id') return 'claude-u-1';
      return '';
    },
    closest() { return null; }
  });
  const assistant = fakeElement({
    innerText: 'Claude answer',
    getAttribute(name) {
      if (name === 'data-testid') return 'assistant-message';
      if (name === 'data-message-id') return 'claude-a-1';
      return '';
    },
    closest() { return null; }
  });
  const selector = '[data-testid="user-message"],[data-testid="assistant-message"],[data-author="user"],[data-author="assistant"],[data-message-author-role="user"],[data-message-author-role="assistant"],[role="article"]';
  const adapter = claudeModule.createClaudeAdapter(fakeDocument({}, { [selector]: [user, assistant] }));
  assert.deepEqual(adapter.getConversationMessages().map(({ id, role, text }) => ({ id, role, text })), [
    { id: 'claude-u-1', role: 'user', text: 'Typed Claude question' },
    { id: 'claude-a-1', role: 'assistant', text: 'Claude answer' }
  ]);
});
test('provider adapters expose composer readiness without submitting', () => {
  for (const factory of [chatgptModule.createChatGptAdapter, claudeModule.createClaudeAdapter]) {
    const isChatGpt = factory === chatgptModule.createChatGptAdapter;
    const composerSelector = isChatGpt
      ? 'textarea[name="prompt-textarea"]'
      : 'div[contenteditable="true"].ProseMirror';
    const sendSelector = isChatGpt
      ? 'button[aria-label="Send prompt"]'
      : 'button[aria-label="Send message"]';
    const composer = fakeElement({ tagName: isChatGpt ? 'TEXTAREA' : 'DIV' });
    const send = fakeElement({ tagName: 'BUTTON', disabled: false });
    const adapter = factory(fakeDocument({
      [composerSelector]: composer,
      [sendSelector]: send
    }));

    assert.equal(adapter.setComposerText('complete question'), true);
    assert.equal(adapter.composerContains('complete question'), true);
    assert.equal(adapter.canSubmit(), true);
    assert.equal(send.clicked, false);
  }
});

test('provider readiness reports a disabled send control', () => {
  const composer = fakeElement({ tagName: 'TEXTAREA', value: 'question' });
  const send = fakeElement({ tagName: 'BUTTON', disabled: true });
  const adapter = chatgptModule.createChatGptAdapter(fakeDocument({
    'textarea[name="prompt-textarea"]': composer,
    'button[aria-label="Send prompt"]': send
  }));
  assert.equal(adapter.composerContains('question'), true);
  assert.equal(adapter.canSubmit(), false);
});

test('Claude distinguishes idle press-to-record from active recording', () => {
  const idle = fakeElement({ tagName: 'BUTTON' });
  const idleAdapter = claudeModule.createClaudeAdapter(fakeDocument({
    'button[aria-label="Press and hold to record"]': idle
  }));
  assert.equal(idleAdapter.isVoiceActive(), false);

  const active = fakeElement({ tagName: 'BUTTON' });
  const activeAdapter = claudeModule.createClaudeAdapter(fakeDocument({
    'button[aria-label^="Release to" i]': active
  }));
  assert.equal(activeAdapter.isVoiceActive(), true);
});

test('Claude adapter reads current role=article conversation turns from captured evidence', () => {
  const user = fakeElement({
    innerText: 'You said: Explain activation. Explain activation. 11:42 am \ue11d \ue064',
    getAttribute(name) { return name === 'role' ? 'article' : ''; },
    closest() { return null; }
  });
  const assistant = fakeElement({
    innerText: 'Claude responded: Start with the target behavior. Start with the target behavior. Then define the metric. \ue056 \ue03b',
    getAttribute(name) { return name === 'role' ? 'article' : ''; },
    closest() { return null; }
  });
  const selector = '[data-testid="user-message"],[data-testid="assistant-message"],[data-author="user"],[data-author="assistant"],[data-message-author-role="user"],[data-message-author-role="assistant"],[role="article"]';
  const adapter = claudeModule.createClaudeAdapter(fakeDocument({}, { [selector]: [user, assistant] }));
  assert.deepEqual(adapter.getConversationMessages().map(({ role, text }) => ({ role, text })), [
    { role: 'user', text: 'Explain activation.' },
    { role: 'assistant', text: 'Start with the target behavior. Then define the metric.' }
  ]);
  assert.equal(adapter.getLatestUserText(), 'Explain activation.');
  assert.equal(adapter.getLatestAssistantText(), 'Start with the target behavior. Then define the metric.');
});

test('Claude recognizes the captured text-only Stop voice control', () => {
  const stop = fakeElement({ tagName: 'BUTTON', innerText: 'Stop' });
  const adapter = claudeModule.createClaudeAdapter(fakeDocument({}, {
    'button': [stop]
  }));
  assert.equal(adapter.isVoiceActive(), true);
});

test('Claude waits for its mounted Send message control before reporting submit readiness', () => {
  assert.ok(claudeModule, 'Claude adapter module must exist');
  const composer = fakeElement({ tagName: 'DIV', textContent: 'question' });
  const send = fakeElement({ tagName: 'BUTTON' });
  let sendMounted = false;
  const doc = {
    querySelector(selector) {
      if (selector === 'div[contenteditable="true"].ProseMirror') return composer;
      if (selector === 'button[aria-label="Send message"]') return sendMounted ? send : null;
      return null;
    },
    querySelectorAll() { return []; }
  };
  const adapter = claudeModule.createClaudeAdapter(doc);
  assert.equal(adapter.canSubmit(), false);
  assert.equal(adapter.submit(), false);
  sendMounted = true;
  assert.equal(adapter.canSubmit(), true);
  assert.equal(adapter.submit(), true);
  assert.equal(send.clicked, true);
});


test('Claude observes the current chat feed and role=main container directly', () => {
  assert.ok(claudeModule, 'Claude adapter module must exist');
  const composer = fakeElement({ tagName: 'DIV' });
  const feed = fakeElement({ tagName: 'DIV' });
  const roleMain = fakeElement({ tagName: 'DIV' });
  const doc = fakeDocument({
    'div[contenteditable="true"].ProseMirror': composer,
    '[role="feed"][aria-label="Chat messages"]': feed,
    'div[role="main"]': roleMain
  });
  const adapter = claudeModule.createClaudeAdapter(doc);
  assert.deepEqual(adapter.getObservationTargets(), [composer, feed, roleMain]);
});


test('Claude removes compact accessibility echo before the visible user prompt', () => {
  const user = fakeElement({
    innerText: 'You said: PMIACLCG20260729144000. PMIA_CLCG_20260729_144000. Reply exactly PMIA_CLCG_OK.',
    getAttribute(name) { return name === 'role' ? 'article' : ''; },
    closest() { return null; }
  });
  const selector = '[data-testid="user-message"],[data-testid="assistant-message"],[data-author="user"],[data-author="assistant"],[data-message-author-role="user"],[data-message-author-role="assistant"],[role="article"]';
  const adapter = claudeModule.createClaudeAdapter(fakeDocument({}, { [selector]: [user] }));

  assert.equal(
    adapter.getLatestUserText(),
    'PMIA_CLCG_20260729_144000. Reply exactly PMIA_CLCG_OK.'
  );
});


test('ChatGPT receiver ignores hidden stale composer and send controls after navigation', () => {
  const hidden = fakeElement({
    tagName: 'TEXTAREA',
    getAttribute: name => name === 'aria-hidden' ? 'true' : '',
    getClientRects: () => []
  });
  const active = fakeElement({
    tagName: 'DIV',
    getAttribute: name => name === 'contenteditable' ? 'true' : '',
    getClientRects: () => [{}]
  });
  const hiddenSend = fakeElement({ tagName: 'BUTTON', getClientRects: () => [] });
  const activeSend = fakeElement({ tagName: 'BUTTON', getClientRects: () => [{}] });
  const lists = {
    'textarea[name="prompt-textarea"]': [hidden],
    '#prompt-textarea': [hidden],
    'div[contenteditable="true"][role="textbox"]': [active],
    'button[aria-label="Send prompt"]': [hiddenSend],
    'button[data-testid="send-button"]': [activeSend]
  };
  const doc = {
    querySelector: selector => lists[selector]?.[0] || null,
    querySelectorAll: selector => lists[selector] || []
  };
  const adapter = chatgptModule.createChatGptAdapter(doc);
  assert.equal(adapter.findComposer(), active);
  assert.equal(adapter.submit(), true);
  assert.equal(hiddenSend.clicked, false);
  assert.equal(activeSend.clicked, true);
});
