import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = resolve(extensionRoot, '..');
const helper = await readFile(resolve(runtimeRoot, 'Session_Tracker_End_Session.ahk'), 'utf8');
const pushScript = await readFile(resolve(runtimeRoot, 'scripts', 'push-session-to-tracker.ps1'), 'utf8');

test('session tracker targets one exact PMIA READY pair', () => {
  assert.match(helper, /PM Session Tracker - Review Studio/);
  assert.match(helper, /DetectManagedSession\(/);
  assert.match(helper, /\^PMIA_\(\?:BOOT_\|REGISTERED_\)\?\(SENDER\|RECEIVER\)_\(CHATGPT\|CLAUDE\)_/);
  assert.match(helper, /DetectHiddenWindows true/);
  assert.match(helper, /WinGetList\("ahk_exe msedge\.exe"\)/);
  assert.match(helper, /No complete READY PMIA sender\/receiver pair/);
  assert.match(helper, /More than one complete PMIA session/);
  assert.doesNotMatch(helper, /VB_SENDER|VB_RECEIVER|\^\+\{F9\}/);
});

test('session tracker exports and ends through the focus-independent control channel', () => {
  assert.match(helper, /PMIA_RUNTIME_CONTROL_V1/);
  assert.match(helper, /SendRuntimeControl\(PMIA_RUNTIME_CONTROL_EXPORT\)/);
  assert.match(helper, /SendRuntimeControl\(PMIA_RUNTIME_CONTROL_END\)/);
  assert.match(helper, /resolve-pmia-session-exports\.ps1/);
  assert.match(helper, /senderFile/);
  assert.match(helper, /receiverFile/);
  assert.doesNotMatch(helper, /SendLevel 1|SendToWindow\("!\{Delete\}"/);
});
test('session tracker has a silent validation path before UI startup', () => {
  assert.match(helper, /A_Args\[1\]\s*=\s*"--validate"/);
  assert.match(helper, /TRACKER_AHK_VALID/);
  assert.ok(helper.indexOf('TRACKER_AHK_VALID') < helper.indexOf('ShowReviewStudio()'));
});

test('session tracker persists only operational paths and review URL', () => {
  assert.match(helper, /review-settings\.ini/);
  const saveStart = helper.indexOf('SaveReviewPreferences() {');
  const saveEnd = helper.indexOf('ShowReviewStudio() {', saveStart);
  const saveBlock = helper.slice(saveStart, saveEnd);
  assert.match(saveBlock, /TrackerRepoPath/);
  assert.match(saveBlock, /DownloadDirectory/);
  assert.match(saveBlock, /ReviewLabUrl/);
  assert.doesNotMatch(saveBlock, /Company|Role|Round|Mode|SessionId|Resume|JobDescription|Prompt|Answer/);
});

test('tracker push script completes dry-run before any Git command', () => {
  assert.match(pushScript, /\[switch\]\$DryRun/);
  assert.match(pushScript, /\[string\]\$DryRunOutputPath/);
  assert.match(pushScript, /tracker-dry-run/);
  assert.match(pushScript, /Dry run completed/);
  const dryRunIndex = pushScript.indexOf('if ($DryRun)');
  const checkoutIndex = pushScript.indexOf('$gitStatus = Run-Git');
  const dryRunBlock = pushScript.slice(dryRunIndex, checkoutIndex);
  assert.ok(dryRunIndex >= 0 && checkoutIndex > dryRunIndex);
  assert.match(dryRunBlock, /exit 0/);
  assert.doesNotMatch(dryRunBlock, /Run-Git/);
});
test('tracker Git runner is explicit and Windows PowerShell 5.1 compatible', () => {
  assert.match(pushScript, /function Run-Git\(\[string\[\]\]\$GitArgs,/);
  assert.match(pushScript, /& git @GitArgs/);
  assert.match(pushScript, /Push-Location/);
  assert.match(pushScript, /Pop-Location/);
  assert.doesNotMatch(pushScript, /function Run-Git\(\[string\[\]\]\$Args,/);
  assert.doesNotMatch(pushScript, /\.ArgumentList/);
});

test('tracker validates one v0.6 sender and receiver before writing state', () => {
  assert.match(pushScript, /Validate-ExportPair/);
  assert.match(pushScript, /Malformed PMIA export pair/);
  assert.match(pushScript, /PMIA session mismatch/);
  assert.match(pushScript, /ResultJsonPath/);
});

test('review studio executes its JSON path decoder during validation', () => {
  assert.match(helper, /DecodeJsonString\(match\[1\]\)/);
  assert.match(helper, /sampleJson :=/);
  assert.match(helper, /Review Studio JSON path decoder validation failed/);
  assert.match(helper, /slash := Chr\(92\)/);
  assert.match(helper, /switch escaped/);
});