import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../simple/chatgpt-main.js', import.meta.url), 'utf8');

test('manifest ChatGPT MAIN entry synchronizes current React ProseMirror state', () => {
  const listeners = new Map();
  const responses = [];
  let reactBeforeInput = 0;
  let inserted = '';
  const form = { __reactPropsLive:{ onBeforeInputCapture(event) {
    reactBeforeInput += 1;
    assert.equal(event.data, 'PMIA live write');
  } } };
  const composer = {
    tagName:'DIV', textContent:'', innerText:'', value:undefined,
    focus(){}, closest(selector){ return selector === 'form' ? form : null; },
    dispatchEvent(){ return true; }
  };
  const selection = { removeAllRanges(){}, addRange(){} };
  const document = {
    querySelector(){ return composer; },
    createRange(){ return { selectNodeContents(){} }; },
    execCommand(name, _ui, value) {
      assert.equal(name, 'insertText');
      inserted = value;
      composer.textContent = value;
      composer.innerText = value;
      return true;
    }
  };
  const window = {
    addEventListener(type, fn){ listeners.set(type, fn); },
    dispatchEvent(event){ responses.push(event.detail); },
    getSelection(){ return selection; }
  };
  document.defaultView = window;
  class TestEvent { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } }
  class TestCustomEvent extends TestEvent {}
  const context = vm.createContext({ window, document, InputEvent:TestEvent, Event:TestEvent,
    CustomEvent:TestCustomEvent, HTMLTextAreaElement:class {} });
  vm.runInContext(source, context);
  const request = listeners.get('pmia-simple:chatgpt-write');
  assert.equal(typeof request, 'function');
  request({ detail:{ requestId:'r1', text:'PMIA live write' } });
  assert.equal(reactBeforeInput, 1);
  assert.equal(inserted, 'PMIA live write');
  assert.equal(responses.at(-1)?.requestId, 'r1');
  assert.equal(responses.at(-1)?.ok, true);
  assert.equal(responses.at(-1)?.matches, true);
});

function runClear(initialText) {
  const listeners = new Map();
  const responses = [];
  let deletes = 0;
  const form = { __reactPropsLive:{ onBeforeInputCapture(){} } };
  const composer = {
    tagName:'DIV', textContent:initialText, innerText:initialText, value:undefined,
    focus(){}, closest(selector){ return selector === 'form' ? form : null; },
    dispatchEvent(){ return true; }
  };
  const selection = { removeAllRanges(){}, addRange(){} };
  const document = {
    querySelector(){ return composer; },
    createRange(){ return { selectNodeContents(){} }; },
    execCommand(name) {
      if (name === 'delete') { deletes += 1; composer.textContent = ''; composer.innerText = ''; return true; }
      return false;
    }
  };
  const window = { addEventListener(type, fn){ listeners.set(type, fn); },
    dispatchEvent(event){ responses.push(event.detail); }, getSelection(){ return selection; } };
  document.defaultView = window;
  class TestEvent { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } }
  class TestCustomEvent extends TestEvent {}
  vm.runInContext(source, vm.createContext({ window, document, InputEvent:TestEvent, Event:TestEvent,
    CustomEvent:TestCustomEvent, HTMLTextAreaElement:class {} }));
  listeners.get('pmia-simple:chatgpt-write')({ detail:{ requestId:'clear-1', action:'clear_stale_setup',
    prefix:'You are a Product Manager interview assistant.' } });
  return { composer, deletes, response:responses.at(-1) };
}

test('manifest ChatGPT MAIN entry clears only PMIA stale sender setup draft', () => {
  const stale = runClear('You are a Product Manager interview assistant. Old setup');
  assert.equal(stale.deletes, 1);
  assert.equal(stale.composer.textContent, '');
  assert.equal(stale.response?.ok, true);
  assert.equal(stale.response?.cleared, true);

  const userDraft = runClear('My unsent interview note');
  assert.equal(userDraft.deletes, 0);
  assert.equal(userDraft.composer.textContent, 'My unsent interview note');
  assert.equal(userDraft.response?.ok, true);
  assert.equal(userDraft.response?.cleared, false);
});
