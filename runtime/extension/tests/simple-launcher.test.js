import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const launcher = fs.readFileSync(new URL('../../Final_2_Window_Extension.ahk', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../../Launch_PMIA_Studio.ps1', import.meta.url), 'utf8');

test('0.12.1 AutoHotkey launcher delegates only to the verified Edge bootstrap', () => {
  assert.ok(launcher.split(/\r?\n/).length < 50);
  assert.match(launcher, /Launch_PMIA_Studio\.ps1/i);
  assert.match(launcher, /AHK_VALID/);
  assert.match(bootstrap, /chrome-extension:\/\//i);
  assert.match(bootstrap, /studio\/index\.html/i);
  assert.match(bootstrap, /--load-extension/i);
  assert.match(bootstrap, /--user-data-dir/i);
  assert.match(bootstrap, /--disable-extensions-except/i);
  assert.match(bootstrap, /0\.12\.1/);
  assert.match(bootstrap, /Refusing to inject extensions into the regular Edge profile/);
});

test('AutoHotkey is absent from delivery and layout ownership', () => {
  assert.doesNotMatch(launcher, /Clipboard|SendBootContext|WaitForLifecycleTitle|Apply2WinLayout|PMIA_FORWARD|Ctrl\+Shift\+F5/i);
  assert.doesNotMatch(launcher, /Gui\(/);
});
