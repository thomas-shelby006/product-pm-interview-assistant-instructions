import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = resolve(extensionRoot, '..');
const helper = await readFile(resolve(runtimeRoot, 'Session_Tracker_End_Session.ahk'), 'utf8');
const pushScript = await readFile(resolve(runtimeRoot, 'scripts', 'push-session-to-tracker.ps1'), 'utf8');

test('session tracker targets the active PMIA extension runtime', () => {
  assert.match(helper, /PM Session Tracker — End Session/);
  assert.match(helper, /FindActivePmiaSession\(/);
  assert.match(helper, /ParsePmiaWindowTitle\(/);
  assert.match(helper, /\^PMIA_\(\?:BOOT_\|REGISTERED_\)\?\(SENDER\|RECEIVER\)_\(CHATGPT\|CLAUDE\)_/);
  assert.match(helper, /DetectHiddenWindows true/);
  assert.match(helper, /WinGetList\("ahk_exe msedge\.exe"\)/);
  assert.doesNotMatch(helper, /VB_SENDER|VB_RECEIVER|\^\+\{F9\}/);
});

test('session tracker exports both current roles and discovers their Markdown files', () => {
  assert.match(helper, /ExportBothWindows\(win1, win2/);
  assert.match(helper, /SendToWindow\("\^\+\{F8\}"/);
  assert.match(helper, /GetDownloadsDirectory\(/);
  assert.match(helper, /FindNewestRoleExport\(/);
  assert.match(helper, /sender/);
  assert.match(helper, /receiver/);
  assert.match(helper, /EXPORT_TIMEOUT/);
  assert.match(helper, /win1\.Value\s*:=/);
  assert.match(helper, /win2\.Value\s*:=/);
});

test('session tracker rejects missing or ambiguous managed sessions precisely', () => {
  assert.match(helper, /NO_ACTIVE_PMIA_SESSION/);
  assert.match(helper, /AMBIGUOUS_PMIA_SESSIONS/);
  assert.match(helper, /completeSessions\.Length/);
  assert.match(helper, /senderHwnd/);
  assert.match(helper, /receiverHwnd/);
});

test('session tracker has a silent AutoHotkey validation path', () => {
  assert.match(helper, /A_Args\[1\]\s*=\s*"--validate"/);
  assert.match(helper, /TRACKER_AHK_VALID/);
  assert.ok(helper.indexOf('TRACKER_AHK_VALID') < helper.indexOf('ShowEndSessionGui()'));
});

test('tracker push script supports a staging-only dry run before any Git write', () => {
  assert.match(pushScript, /\[switch\]\$DryRun/);
  assert.match(pushScript, /\[string\]\$DryRunOutputPath/);
  assert.match(pushScript, /tracker-dry-run/);
  assert.match(pushScript, /if \(\$DryRun\)/);
  assert.match(pushScript, /Dry run completed/);
  const dryRunIndex = pushScript.indexOf('if ($DryRun)');
  const checkoutIndex = pushScript.indexOf("Run-Git @('checkout','main')");
  assert.ok(dryRunIndex >= 0 && checkoutIndex > dryRunIndex);
  assert.match(pushScript.slice(dryRunIndex, checkoutIndex), /return/);
});

test('tracker Git runner does not shadow PowerShell automatic Args', () => {
  assert.match(pushScript, /function Run-Git\(\[string\[\]\]\$GitArgs,/);
  assert.match(pushScript, /& git @GitArgs/);
  assert.doesNotMatch(pushScript, /function Run-Git\(\[string\[\]\]\$Args,/);
});

test('tracker Git runner is compatible with Windows PowerShell 5.1', () => {
  assert.match(pushScript, /& git @GitArgs/);
  assert.match(pushScript, /Push-Location/);
  assert.match(pushScript, /Pop-Location/);
  assert.doesNotMatch(pushScript, /\.ArgumentList/);
});

test('session tracker sends PMIA hotkeys above the default AutoHotkey input level', () => {
  assert.match(helper, /SendMode "Input"/);
  assert.match(helper, /SendLevel 1/);
  assert.match(helper, /SendToWindow\("!\{Delete\}"/);
});
