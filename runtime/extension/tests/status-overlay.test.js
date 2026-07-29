import test from 'node:test';
import assert from 'node:assert/strict';
import { createStatusOverlay } from '../content/status-overlay.js';

function createDocument() {
  const parent = { appendChild(node) { node.parentNode = parent; } };
  return {
    body: parent,
    documentElement: parent,
    createElement() {
      return {
        id: '', textContent: '', style: {}, attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        remove() {}
      };
    }
  };
}

test('transient status restores the latest stable link state', () => {
  let scheduled = null;
  const overlay = createStatusOverlay(
    createDocument(),
    { role: 'sender', provider: 'chatgpt' },
    {
      setTimeoutFn(callback) { scheduled = callback; return 1; },
      clearTimeoutFn() {}
    }
  );
  overlay.setStatus('LINK OK', 'ok');
  overlay.setStatus('FORWARDED', 'ok', 1200);
  assert.match(overlay.element.textContent, /FORWARDED/);
  scheduled();
  assert.match(overlay.element.textContent, /LINK OK/);
});