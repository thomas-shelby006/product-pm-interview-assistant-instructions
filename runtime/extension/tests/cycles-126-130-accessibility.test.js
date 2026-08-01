import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultShortcutBindings, normalizeShortcutBindings, resolveShortcutCommand, validateShortcutBinding } from '../shared/shortcut-bindings.js';
import { deriveShortcutHelp } from '../dashboard/shortcut-help-model.js';
import { normalizeAccessibilityPreferences } from '../dashboard/accessibility-preferences.js';
import { createLiveAnnouncer } from '../dashboard/live-announcer.js';

function node() { return { textContent: '' }; }

test('Cycle 126: shortcut bindings are normalized and conflicts are explicit', () => {
  const defaults = defaultShortcutBindings();
  assert.equal(defaults.command_palette, 'Control+KeyK');
  const conflict = validateShortcutBinding('open_shortcut_help', 'Ctrl+K', defaults);
  assert.equal(conflict.error, 'shortcut_conflict');
  assert.equal(resolveShortcutCommand(defaults, { ctrlKey: true, key: 'k' }), 'open_command_palette');
});

test('Cycle 127: shortcut help is complete and label-driven', () => {
  const help = deriveShortcutHelp(normalizeShortcutBindings());
  assert.equal(help.rows.some(item => item.command === 'open_shortcut_help'), true);
  assert.equal(help.rows.every(item => item.label && item.chord), true);
});

test('Cycle 128: accessibility preferences are bounded and reversible', () => {
  const prefs = normalizeAccessibilityPreferences({ contrast: 'high', unknown: true });
  assert.equal(prefs.contrast, 'high');
  assert.equal('unknown' in prefs, false);
});

test('Cycle 129: live announcements deduplicate repeated messages inside the gap', async () => {
  const polite = node(); const assertive = node(); let time = 100;
  const announcer = createLiveAnnouncer({ politeNode: polite, assertiveNode: assertive, now: () => time, minGapMs: 500 });
  assert.equal(announcer.announce('Ready'), true);
  await Promise.resolve();
  assert.equal(polite.textContent, 'Ready');
  time = 200;
  assert.equal(announcer.announce('Ready'), false);
  assert.equal(announcer.announce('Delivery blocked', { priority: 'assertive' }), true);
  await Promise.resolve();
  assert.equal(assertive.textContent, 'Delivery blocked');
});

test('Cycle 130: dashboard source uses one focus coordinator and session-scoped preference command', async () => {
  const { readFile } = await import('node:fs/promises');
  const dashboard = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
  const protocol = await readFile(new URL('../shared/dashboard-protocol.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');
  assert.match(dashboard, /createDialogFocusCoordinator/);
  assert.match(dashboard, /set_accessibility_preference/);
  assert.match(protocol, /set_accessibility_preference/);
  assert.match(html, /id="shortcutHelpDialog"/);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /data-accessibility-name="reducedMotion"/);
});
