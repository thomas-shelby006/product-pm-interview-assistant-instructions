import test from 'node:test';
import assert from 'node:assert/strict';

const chatgpt = await import('../simple/adapters/chatgpt.js').catch(() => null);
const claude = await import('../simple/adapters/claude.js').catch(() => null);
const claudeMain = await import('../simple/claude-main-writer.js').catch(() => null);
const chatgptMain = await import('../simple/chatgpt-main-writer.js').catch(() => null);

function element({ text = '', attrs = {}, disabled = false } = {}) {
  return {
    textContent: text,
    innerText: text,
    value: text,
    disabled,
    attrs,
    clicked: 0,
    getAttribute(name) { return this.attrs[name] ?? null; },
    getClientRects() { return [{}]; },
    click() { this.clicked += 1; }
  };
}

function docWith(map = {}) {
  return {
    querySelector(selector) { return (map[selector] || [])[0] || null; },
    querySelectorAll(selector) { return map[selector] || []; }
  };
}

test('simple provider modules exist', () => {
  assert.ok(chatgpt);
  assert.ok(claude);
  assert.ok(claudeMain);
  assert.ok(chatgptMain);
});

test('ChatGPT verifies current semantic rendered user turn before success', async () => {
  const composer = element();
  const send = element();
  const user = element({ text:'You said: Activation metric?', attrs:{'data-turn':'user','data-turn-id':'t1'} });
  const doc = docWith({
    '#prompt-textarea':[composer],
    'button[aria-label="Send prompt"]':[send],
    'section[data-turn="user"][data-turn-id]':[user]
  });
  const adapter = chatgpt.createSimpleChatGptAdapter({ doc, writeInMain:async text => {
    composer.textContent = text; composer.innerText = text; composer.value = text;
    return { ok:true, matches:true };
  } });
  assert.equal(adapter.isReady(), true);
  assert.equal(await adapter.write('Activation metric?'), true);
  assert.equal(adapter.verifyComposer('Activation metric?'), true);
  assert.equal(adapter.submit(), true);
  assert.equal(await adapter.verifyRenderedTurn('Activation metric?', { timeoutMs:0 }), true);
  assert.deepEqual(adapter.readUserTurns(), [{ id:'t1', text:'Activation metric?' }]);
});

test('Claude MAIN writer updates Tiptap editor and emits bubbled input', () => {
  let setContentArg = null;
  let inputEvents = 0;
  const composer = element();
  composer.editor = {
    commands: { setContent(value) { setContentArg = value; return true; } },
    getText() { return 'Tradeoff?'; }
  };
  composer.dispatchEvent = event => { if (event.type === 'input') inputEvents += 1; return true; };
  const doc = docWith({ 'div[contenteditable="true"].ProseMirror':[composer] });
  const result = claudeMain.writeClaudeComposerInMain(doc, 'Tradeoff?');
  assert.equal(result.ok, true);
  assert.equal(inputEvents, 1);
  assert.ok(setContentArg);
});

test('Claude adapter never reports write success without MAIN bridge acknowledgement', async () => {
  const composer = element({ text:'Tradeoff?' });
  const send = element();
  const user = element({ text:'Tradeoff?', attrs:{'data-testid':'user-message'} });
  const doc = docWith({
    'div[contenteditable="true"].ProseMirror':[composer],
    'button[aria-label="Send message"]':[send],
    '[data-testid="user-message"]':[user]
  });
  const failed = claude.createSimpleClaudeAdapter({ doc, writeInMain: async () => ({ ok:false }) });
  assert.equal(await failed.write('Tradeoff?'), false);
  const adapter = claude.createSimpleClaudeAdapter({ doc, writeInMain: async () => ({ ok:true, matches:true }) });
  assert.equal(adapter.isReady(), true);
  assert.equal(await adapter.write('Tradeoff?'), true);
  assert.equal(adapter.verifyComposer('Tradeoff?'), true);
  assert.equal(adapter.submit(), true);
  assert.equal(await adapter.verifyRenderedTurn('Tradeoff?', { timeoutMs:0 }), true);
  assert.deepEqual(adapter.readUserTurns(), [{ id:'claude-user-1', text:'Tradeoff?' }]);
});

test('ChatGPT MAIN writer uses framework editor state when available', () => {
  let setContentArg = null;
  let inputEvents = 0;
  const composer = element();
  composer.editor = {
    commands:{ setContent(value) { setContentArg = value; composer.textContent = 'Activation metric?'; return true; } },
    getText() { return composer.textContent; }
  };
  composer.dispatchEvent = event => { if (event.type === 'input') inputEvents += 1; return true; };
  const doc = docWith({ '#prompt-textarea':[composer] });
  const result = chatgptMain.writeChatGptComposerInMain(doc, 'Activation metric?');
  assert.equal(result.ok, true);
  assert.equal(inputEvents, 1);
  assert.ok(setContentArg);
});
