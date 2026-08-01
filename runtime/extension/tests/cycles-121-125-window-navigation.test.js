import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { issueFocusGesture, validateFocusGesture } from '../shared/focus-gesture-token.js';
import { pushLayoutHistory, popLayoutHistory } from '../shared/layout-history.js';
import { normalizeWindowNavigationIntent, navigationCommand } from '../shared/window-navigation-intent.js';
import { deriveManagedWindowModel } from '../dashboard/managed-window-model.js';
import { windowUpdateForBounds } from '../shared/window-layout.js';

test('Cycle 121 navigator targets only sender receiver or Pilot managed surfaces', () => {
  assert.deepEqual(normalizeWindowNavigationIntent({ target: 'sender', action: 'focus' }), { target: 'sender', action: 'focus', focusIntent: null });
  assert.equal(navigationCommand('receiver', 'focus'), 'focus_receiver');
  assert.equal(navigationCommand('pilot', 'spotlight'), 'spotlight_pilot');
  assert.equal(normalizeWindowNavigationIntent({ target: 'unmanaged', action: 'focus' }).target, '');
});

test('Cycles 122-124 layout history is bounded and back returns the prior managed view', () => {
  let history = [];
  history = pushLayoutHistory(history, { mode: 'three_window', focusedRole: 'sender' }, 1);
  history = pushLayoutHistory(history, { mode: 'receiver_dashboard', focusedRole: 'receiver' }, 2);
  const popped = popLayoutHistory(history);
  assert.deepEqual(popped.value, { mode: 'receiver_dashboard', focusedRole: 'receiver', at: 2 });
  assert.equal(popped.history.length, 1);
  assert.equal(deriveManagedWindowModel({ layout: { mode: 'sender_dashboard', focusedRole: 'sender', history } }).description, 'Window 1 spotlight');
});

test('Cycle 125 focus gesture is short-lived one-use and session target action bound', () => {
  const token = issueFocusGesture({ sessionId: 's1', target: 'sender', action: 'focus', now: 1000, ttlMs: 1000, id: 'g1' });
  const consumed = new Set();
  assert.equal(validateFocusGesture(token, { sessionId: 's1', target: 'sender', action: 'focus', now: 1500, consumed }).ok, true);
  assert.equal(validateFocusGesture(token, { sessionId: 's1', target: 'sender', action: 'focus', now: 1501, consumed }).error, 'focus_intent_consumed');
  assert.equal(validateFocusGesture(token, { sessionId: 's2', target: 'sender', action: 'focus', now: 1500 }).error, 'focus_intent_mismatch');
  assert.equal(validateFocusGesture(token, { sessionId: 's1', target: 'sender', action: 'focus', now: 2500 }).error, 'focus_intent_expired');
});

test('normal layout updates are explicitly non-focused', () => {
  assert.equal(windowUpdateForBounds({ left: 0, top: 0, width: 400, height: 600 }).focused, false);
});

test('controller focused window mutation is guarded by focus intent validation', async () => {
  const source = await readFile(new URL('../shared/runtime-pilot-controller.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function focusManagedWindow');
  const end = source.indexOf('async function setHidden', start);
  const block = source.slice(start, end);
  assert.match(block, /validateFocusGesture/);
  assert.match(block, /if \(!validation\.ok\) return validation/);
  assert.match(block, /chromeApi\.windows\.update\(windowId, \{ focused: true/);
  assert.doesNotMatch(source.slice(source.indexOf('async function repair'), start), /focused:\s*true/);
});
