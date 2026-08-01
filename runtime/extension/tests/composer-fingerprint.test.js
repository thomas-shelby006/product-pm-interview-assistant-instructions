import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposerFingerprint, sameComposerOwnership } from '../content/composer-fingerprint.js';

function composer(text, attrs = {}) { return { tagName: 'DIV', textContent: text, getAttribute: name => attrs[name] ?? null }; }

test('composer fingerprint treats structural rerender with identical normalized text as same ownership', () => {
  const first = createComposerFingerprint(composer('Hello   world', { role: 'textbox', contenteditable: 'true' }), { revision: 1 });
  const second = createComposerFingerprint(composer('Hello world', { role: 'textbox', contenteditable: 'true' }), { revision: 2 });
  assert.equal(sameComposerOwnership(first, second), true);
});

test('composer fingerprint detects text ownership change without storing text', () => {
  const first = createComposerFingerprint(composer('PMIA draft'));
  const second = createComposerFingerprint(composer('Manual draft'));
  assert.equal(sameComposerOwnership(first, second), false);
  assert.equal('text' in first, false);
});