import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const launcherPath = resolve(extensionRoot, '..', 'Final_2_Window_Extension.ahk');
const launcher = await readFile(launcherPath, 'utf8');

function block(start, end) {
  return launcher.slice(launcher.indexOf(start), launcher.indexOf(end));
}

test('launcher standardizes on Edge Stable and the selected profile', () => {
  assert.match(launcher, /Microsoft\\Edge\\Application\\msedge\.exe/);
  assert.match(launcher, /--profile-directory=\\?"' g_selectedProfileDirectory '\\?"/);
  assert.match(launcher, /--new-window/);
  assert.match(launcher, /--app=/);
  assert.doesNotMatch(launcher, /Edge Beta|Canary|Chrome\\Application/i);
});

test('launcher closes only PMIA lifecycle windows', () => {
  assert.match(launcher, /CloseManagedPmiaWindows\(/);
  assert.match(launcher, /\^PMIA_\(\?:BOOT_\|REGISTERED_\)\?\(SENDER\|RECEIVER\)_\(CHATGPT\|CLAUDE\)_/);
  assert.match(launcher, /WinGetList\("ahk_exe msedge\.exe"\)/);
  assert.doesNotMatch(launcher, /taskkill|ProcessClose\("msedge\.exe"\)/i);
});

test('launcher retains final session-suffixed ready titles', () => {
  assert.match(launcher, /RuntimeLifecycleTitle\(role, provider, sessionId, phase/);
  assert.match(launcher, /base := RuntimeWindowTitle\(role, provider, sessionId\)/);
  assert.match(launcher, /WaitForLifecyclePair\("ready", 30000\)/);
});

test('launcher reads profile doctor output and persists only safe preferences', () => {
  assert.match(launcher, /Browser_Profile_Doctor\.ps1/);
  assert.match(launcher, /ComObject\("WScript\.Shell"\)\.Exec/);
  assert.match(launcher, /LoadStudioPreferences\(\)/);
  assert.match(launcher, /SaveStudioPreferences\(\)/);
  assert.match(launcher, /settings\.ini/);
  const saveBlock = block('SaveStudioPreferences()', 'RunProfileDoctor(');
  for (const key of ['ProfileDirectory', 'SenderProvider', 'ReceiverProvider', 'LayoutMode']) {
    assert.match(saveBlock, new RegExp(`IniWrite[\\s\\S]*${key}`));
  }
  assert.doesNotMatch(saveBlock, /Resume|JobDescription|SessionNotes|Prompt|Answer|sessionId/i);
});

test('profile selection prefers a saved valid profile then a matching PMIA profile', () => {
  assert.match(launcher, /SelectRecommendedProfile\(/);
  assert.match(launcher, /record\["issueCode"\]\s*=\s*"OK"/);
  assert.match(launcher, /g_selectedProfileDirectory/);
});

test('preflight diagnoses the selected profile without silently switching profiles', () => {
  assert.match(launcher, /RefreshSelectedProfileDoctor\(\)/);
  const preflightBlock = block('RunStudioPreflight(*)', 'FindLifecycleWindow(');
  assert.match(preflightBlock, /WaitForSelectedProfileReady\(\)/);
  assert.doesNotMatch(preflightBlock, /SelectRecommendedProfile\(/);
});

test('preflight waits for Edge to persist a path-matched extension version reload', () => {
  assert.match(launcher, /WaitForSelectedProfileReady\(timeoutMs := 15000\)/);
  const settleBlock = block('WaitForSelectedProfileReady(timeoutMs := 15000)', 'NormalizeProvider(value)');
  assert.match(settleBlock, /EXTENSION_VERSION_MISMATCH/);
  assert.match(settleBlock, /Sleep 500/);
  const preflightBlock = block('RunStudioPreflight(*)', 'FindLifecycleWindow(');
  assert.match(preflightBlock, /WaitForSelectedProfileReady\(\)/);
});
test('cleanup includes hidden PMIA lifecycle windows and restores the prior detection mode', () => {
  const cleanup = block('CloseManagedPmiaWindows(sessionId := "")', 'AutoStartup()');
  assert.match(cleanup, /previousDetectHidden := A_DetectHiddenWindows/);
  assert.match(cleanup, /DetectHiddenWindows true/);
  assert.match(cleanup, /DetectHiddenWindows previousDetectHidden/);
});
test('new launches close all PMIA windows while repair is scoped to the current session', () => {
  const launchBlock = block('RunManagedLaunch(reuseSession := false)', 'ApplyConfiguredInitialLayout()');
  assert.match(launchBlock, /if !reuseSession[\s\S]*CloseManagedPmiaWindows\(\)/);
  assert.match(launchBlock, /else[\s\S]*CloseManagedPmiaWindows\(g_sessionId\)/);
});
test('session studio exposes browser health and operational actions', () => {
  assert.match(launcher, /PM Interview Assistant — Session Studio/);
  assert.match(launcher, /Microsoft Edge Stable/);
  assert.match(launcher, /Run Preflight/);
  assert.match(launcher, /Repair Launch/);
  assert.match(launcher, /Swap route/);
  assert.match(launcher, /Launch Interview/);
  assert.match(launcher, /Show\("w960 h780"\)/);
});

test('session studio provides route and context feedback', () => {
  assert.match(launcher, /g_routeSummary/);
  assert.match(launcher, /UpdateLaunchRouteSummary/);
  assert.match(launcher, /SwapLaunchProviders/);
  assert.match(launcher, /g_contextStatus/);
  assert.match(launcher, /Resume.*characters/);
  assert.match(launcher, /Job description.*characters/i);
  assert.match(launcher, /Resume, JD, and notes stay in memory/);
});

test('short context uses inline two-step confirmation with no modal', () => {
  assert.match(launcher, /ArmShortContextConfirmation\(\)/);
  assert.match(launcher, /ResetShortContextConfirmation\(\)/);
  assert.match(launcher, /Launch Anyway/);
  const launchBlock = block('StartLaunchFromGui(*)', 'CloseSessionLaunchGui(*)');
  assert.doesNotMatch(launchBlock, /MsgBox/);
  assert.match(launchBlock, /g_shortContextArmedUntil/);
});

test('launcher uses explicit lifecycle launch states and repair classifications', () => {
  for (const fn of [
    'SetLaunchState', 'WaitForLifecycleTitle', 'DiagnoseLaunchFailure',
    'RunManagedLaunch', 'RepairLaunch', 'RunStudioPreflight'
  ]) assert.match(launcher, new RegExp(`${fn}\\(`));
  for (const state of [
    'PREFLIGHT', 'LAUNCHING', 'WAITING_BOOT', 'WAITING_REGISTRATION',
    'WAITING_COMPOSER', 'READY', 'ERROR'
  ]) assert.match(launcher, new RegExp(`"${state}"`));
  assert.doesNotMatch(launcher, /Win1 was not detected|Win2 was not detected/);
});

test('repair opens the selected profile extension page without editing browser preferences', () => {
  assert.match(launcher, /edge:\/\/extensions\/\?id=/);
  assert.match(launcher, /--profile-directory=\\?"' g_selectedProfileDirectory '\\?"/);
  assert.doesNotMatch(launcher, /Secure Preferences|Preferences.*FileAppend|RegWrite/i);
});

test('launcher stores diagnostics outside the repository', () => {
  assert.match(launcher, /SETTINGS_DIR\s*:=\s*EnvGet\("LOCALAPPDATA"\)\s+"\\PMInterviewAssistant"/);
  assert.match(launcher, /LOG_DIR\s*:=\s*SETTINGS_DIR\s+"\\logs"/);
  assert.match(launcher, /DirCreate LOG_DIR/);
  assert.doesNotMatch(launcher, /A_ScriptDir\s+"\\runtime_logs"/);
});

test('startup studio opens synchronously without timer races', () => {
  assert.doesNotMatch(launcher, /SetTimer ShowSessionLaunchGui/);
  assert.ok(launcher.indexOf('ShowSessionLaunchGui()') < launcher.indexOf('~LAlt::return'));
});

test('closing the session studio releases every operational control reference', () => {
  const closeBlock = block('CloseSessionLaunchGui(*)', 'AutoStartup() {');
  for (const control of [
    'g_launchGui', 'g_resumeEdit', 'g_jdEdit', 'g_metaEdit',
    'g_senderProviderDdl', 'g_receiverProviderDdl', 'g_profileDdl',
    'g_routeSummary', 'g_contextStatus', 'g_launchStatus',
    'g_runtimeHealth', 'g_preflightButton', 'g_repairButton', 'g_launchButton'
  ]) assert.match(closeBlock, new RegExp(`${control}\\s*:=\\s*0`));
});

test('Alt+E exports sender and receiver role-scoped records', () => {
  const exportBlock = launcher.match(/!e:: \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(exportBlock, /global g_hWin1, g_hWin2/);
  assert.match(exportBlock, /SendToWindow\("", "\^\+\{F8\}", g_hWin1\)/);
  assert.match(exportBlock, /SendToWindow\("", "\^\+\{F8\}", g_hWin2\)/);
});

test('operational checks reacquire exact managed window handles after Edge replaces them', () => {
  assert.match(launcher, /RefreshManagedWindowHandles\(\)/);
  const refreshStart = launcher.indexOf('RefreshManagedWindowHandles()');
  const refreshEnd = launcher.indexOf('IsAlive(hWnd)', refreshStart);
  const refreshBlock = launcher.slice(refreshStart, refreshEnd);
  assert.match(refreshBlock, /DetectHiddenWindows true/);
  assert.match(refreshBlock, /FindLifecycleWindow\("sender"/);
  assert.match(refreshBlock, /FindLifecycleWindow\("receiver"/);
  assert.match(refreshBlock, /g_hWin1\s*:=\s*sender\["hwnd"\]/);
  assert.match(refreshBlock, /g_hWin2\s*:=\s*receiver\["hwnd"\]/);
  assert.match(refreshBlock, /g_hWin1\s*:=\s*0/);
  assert.match(refreshBlock, /g_hWin2\s*:=\s*0/);
  const activeStart = launcher.indexOf('IsActiveSession() {');
  const activeEnd = launcher.indexOf('RefreshManagedWindowHandles() {', activeStart);
  const activeBlock = launcher.slice(activeStart, activeEnd + 'RefreshManagedWindowHandles()'.length);
  assert.match(activeBlock, /g_interviewActive/);
  assert.match(activeBlock, /RefreshManagedWindowHandles\(\)/);
});