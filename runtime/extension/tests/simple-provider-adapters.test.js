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

test('ChatGPT exposes latest assistant text for one-shot review only', () => {
  const assistant = element({ text:'A concise product answer.' });
  const doc = docWith({ 'section[data-turn="assistant"]':[assistant] });
  const adapter = chatgpt.createSimpleChatGptAdapter({ doc, writeInMain:async () => ({ ok:true, matches:true }) });
  assert.equal(adapter.readLatestAssistantText(), 'A concise product answer.');
});

test('Claude exposes latest assistant text for one-shot review only', () => {
  const assistant = element({ text:'A concise Claude answer.' });
  const doc = docWith({ '[data-testid="assistant-message"]':[assistant] });
  const adapter = claude.createSimpleClaudeAdapter({ doc, writeInMain:async () => ({ ok:true, matches:true }) });
  assert.equal(adapter.readLatestAssistantText(), 'A concise Claude answer.');
});

test('ChatGPT MAIN writer synchronizes ProseMirror state without node.editor', () => {
  const events = [];
  let inserted = null;
  let selected = false;
  const composer = element();
  composer.tagName = 'DIV';
  composer.value = undefined;
  composer.focus = () => {};
  composer.dispatchEvent = event => { events.push(event.type); return true; };
  const selection = { removeAllRanges() {}, addRange() { selected = true; } };
  const range = { selectNodeContents(node) { assert.equal(node, composer); } };
  const doc = docWith({ '#prompt-textarea':[composer] });
  doc.defaultView = { getSelection:() => selection };
  doc.createRange = () => range;
  doc.execCommand = (name, _showUi, value) => {
    assert.equal(name, 'insertText');
    inserted = value;
    composer.textContent = value;
    composer.innerText = value;
    return true;
  };
  const result = chatgptMain.writeChatGptComposerInMain(doc, 'Activation metric?');
  assert.equal(result.ok, true);
  assert.equal(inserted, 'Activation metric?');
  assert.equal(selected, true);
  assert.deepEqual(events, ['beforeinput', 'input']);
});

test('ChatGPT MAIN writer uses React before-input fallback when Send state is absent', () => {
  let beforeInputCalls = 0;
  const composer = element();
  composer.tagName = 'DIV';
  composer.value = undefined;
  composer.focus = () => {};
  composer.dispatchEvent = () => true;
  const form = { __reactPropsTest:{ onBeforeInputCapture(event) {
    beforeInputCalls += 1;
    assert.equal(event.data, 'Activation metric?');
    assert.equal(event.target, composer);
  } } };
  composer.closest = selector => selector === 'form' ? form : null;
  const doc = docWith({ '#prompt-textarea':[composer] });
  doc.defaultView = { getSelection:() => ({ removeAllRanges(){}, addRange(){} }) };
  doc.createRange = () => ({ selectNodeContents(){} });
  doc.execCommand = (_name, _ui, value) => { composer.innerText = value; composer.textContent = value; return true; };
  const result = chatgptMain.writeChatGptComposerInMain(doc, 'Activation metric?');
  assert.equal(result.ok, true);
  assert.equal(beforeInputCalls, 1);
});

test('ChatGPT submits through the composer form when current UI has no Send button', () => {
  let submitted = 0;
  const composer = element({ text:'Activation metric?' });
  composer.closest = selector => selector === 'form' ? {
    requestSubmit() { submitted += 1; }
  } : null;
  const doc = docWith({ '#prompt-textarea':[composer] });
  const adapter = chatgpt.createSimpleChatGptAdapter({ doc, writeInMain:async () => ({ ok:true, matches:true }) });
  assert.equal(adapter.submit(), true);
  assert.equal(submitted, 1);
});

test('Claude submits with Enter when current UI has no Send button', () => {
  const events = [];
  const composer = element({ text:'Tradeoff?' });
  composer.dispatchEvent = event => { events.push({ type:event.type, key:event.key, code:event.code }); return false; };
  const doc = docWith({ 'div[contenteditable="true"].ProseMirror':[composer] });
  doc.defaultView = { KeyboardEvent:class {
    constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
  } };
  const adapter = claude.createSimpleClaudeAdapter({ doc, writeInMain:async () => ({ ok:true, matches:true }) });
  assert.equal(adapter.submit(), true);
  assert.deepEqual(events, [{ type:'keydown', key:'Enter', code:'Enter' }]);
});

test('Claude Enter fallback focuses the exact composer and fails closed if focus cannot move', () => {
  const makeDoc = ({ allowFocus }) => {
    const events = [];
    const other = element({ text:'other' });
    const composer = element({ text:'Tradeoff?' });
    const doc = docWith({ 'div[contenteditable="true"].ProseMirror':[composer] });
    doc.activeElement = other;
    composer.focus = () => { if (allowFocus) doc.activeElement = composer; };
    composer.dispatchEvent = event => { events.push(event.type); return false; };
    doc.defaultView = { KeyboardEvent:class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } } };
    return { doc, composer, events };
  };

  const focused = makeDoc({ allowFocus:true });
  const ok = claude.createSimpleClaudeAdapter({ doc:focused.doc, writeInMain:async () => ({ ok:true, matches:true }) });
  assert.equal(ok.submit(), true);
  assert.equal(focused.doc.activeElement, focused.composer);
  assert.deepEqual(focused.events, ['keydown']);

  const blocked = makeDoc({ allowFocus:false });
  const fail = claude.createSimpleClaudeAdapter({ doc:blocked.doc, writeInMain:async () => ({ ok:true, matches:true }) });
  assert.equal(fail.submit(), false);
  assert.deepEqual(blocked.events, []);
});
