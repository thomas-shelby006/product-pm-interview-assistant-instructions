import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const launcher = fs.readFileSync(new URL('../../Final_2_Window_Extension.ahk', import.meta.url), 'utf8');

test('0.12 AutoHotkey launcher is a small Studio bootstrap only', () => {
  const lines = launcher.split(/\r?\n/).length;
  assert.ok(lines < 120, `launcher is still ${lines} lines`);
  assert.match(launcher, /chrome-extension:\/\//i);
  assert.match(launcher, /studio\/index\.html/i);
  assert.match(launcher, /--profile-directory/i);
  assert.match(launcher, /IniRead\(SettingsPath,\s*"Runtime",\s*"ExtensionId"/i);
  assert.match(launcher, /AHK_VALID/);
});

test('AutoHotkey is absent from delivery and layout ownership', () => {
  assert.doesNotMatch(launcher, /Clipboard|SendBootContext|WaitForLifecycleTitle|Apply2WinLayout|PMIA_FORWARD|Ctrl\+Shift\+F5/i);
  assert.doesNotMatch(launcher, /Gui\(/);
});
