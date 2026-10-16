import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = new URL('../../', import.meta.url);
const launcher = fs.readFileSync(new URL('Launch_PMIA_Studio.ps1', runtime), 'utf8');
const worker = fs.readFileSync(new URL('../simple/service-worker.js', import.meta.url), 'utf8');

test('the PowerShell launcher is the only Windows bootstrap', () => {
  assert.equal(fs.existsSync(new URL('Final_2_Window_Extension.ahk', runtime)), false);
  assert.ok(launcher.split(/\r?\n/).length < 160, 'launcher should remain focused');
  assert.match(launcher, /chrome-extension:\/\//i);
  assert.match(launcher, /studio\/index\.html/i);
  assert.match(launcher, /--load-extension/i);
  assert.match(launcher, /--user-data-dir/i);
  assert.match(launcher, /--disable-extensions-except/i);
  assert.match(launcher, /0\.12\.1/);
  assert.match(launcher, /ValidateOnly/);
});

test('launch isolation protects the regular Edge profile and never automates answers', () => {
  assert.match(launcher, /Refusing to inject extensions into the regular Edge profile/);
  assert.match(launcher, /PMInterviewAssistant\\EdgeProfile/);
  assert.match(launcher, /Open PMIA Studio/);
  assert.doesNotMatch(launcher, /Clipboard|SendBootContext|Apply2WinLayout|PMIA_FORWARD|Gui\(/);
});

test('extension toolbar remains a standalone Studio entry point', () => {
  assert.match(worker, /chrome\.action\.onClicked\.addListener/);
  assert.match(worker, /studio\/index\.html/);
  assert.match(worker, /chrome\.windows\.create/);
});
