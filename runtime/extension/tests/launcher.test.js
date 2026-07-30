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
  assert.match(launcher, /WaitForLifecycleTitle\("sender", g_senderProvider, g_sessionId, "ready", COMPOSER_READY_TIMEOUT_MS\)/);
  assert.match(launcher, /WaitForLifecycleTitle\("receiver", g_receiverProvider, g_sessionId, "ready", COMPOSER_READY_TIMEOUT_MS\)/);
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
  assert.match(launcher, /Show\("w960 h900"\)/);
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
  const hotkeyBlock = launcher.match(/!e:: \{[\s\S]*?\n\}/)?.[0] || '';
  const exportBlock = launcher.slice(launcher.indexOf('ExportActiveSession() {'), launcher.indexOf('; Alt+Q'));
  assert.match(hotkeyBlock, /ExportActiveSession\(\)/);
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
  assert.match(activeBlock, /RefreshManagedWindowHandles\(\)/);
});

test('active session derives from exact lifecycle windows rather than a mutable flag', () => {
  const activeStart = launcher.indexOf('IsActiveSession() {');
  const activeEnd = launcher.indexOf('RefreshManagedWindowHandles() {', activeStart);
  const activeBlock = launcher.slice(activeStart, activeEnd);
  assert.ok(activeBlock.includes('return RefreshManagedWindowHandles()'));
  assert.ok(!activeBlock.includes('g_interviewActive &&'));
  const refreshStart = launcher.indexOf('RefreshManagedWindowHandles() {');
  const refreshEnd = launcher.indexOf('IsAlive(hWnd)', refreshStart);
  const refreshBlock = launcher.slice(refreshStart, refreshEnd);
  assert.ok(!refreshBlock.includes('!g_interviewActive'));
});

test('launcher foregrounds each registered provider before its composer readiness wait', () => {
  const launch = launcher.slice(
    launcher.indexOf('RunManagedLaunch(reuseSession := false)'),
    launcher.indexOf('ApplyConfiguredInitialLayout()')
  );
  const senderRegistered = launch.indexOf('senderRegistered :=');
  const senderReady = launch.indexOf('senderReady :=');
  const receiverRegistered = launch.indexOf('receiverRegistered :=');
  const receiverReady = launch.indexOf('receiverReady :=');
  assert.ok(launch.slice(senderRegistered, senderReady).includes('WinActivate "ahk_id " senderRegistered["hwnd"]'));
  assert.ok(launch.slice(receiverRegistered, receiverReady).includes('WinActivate "ahk_id " receiverRegistered["hwnd"]'));
});

test('Alt+Delete closes every managed PMIA lifecycle window even with stale cached state', () => {
  const hotkeyBlock = launcher.match(/!Delete:: \{[\s\S]*?\n\}/)?.[0] || '';
  const endStart = launcher.indexOf('EndActiveSession() {');
  const endBlock = launcher.slice(endStart, launcher.indexOf('; Alt+E', endStart));
  assert.match(hotkeyBlock, /EndActiveSession\(\)/);
  assert.match(endBlock, /CloseManagedPmiaWindows\(\)/);
  assert.match(endBlock, /g_interviewActive\s*:=\s*false/);
  assert.match(endBlock, /ExitApp/);
  assert.doesNotMatch(endBlock, /if IsAlive\(g_hWin1\)/);
});

test('launcher confirms sender readiness before opening the receiver window', () => {
  const launch = launcher.slice(
    launcher.indexOf('RunManagedLaunch(reuseSession := false)'),
    launcher.indexOf('ApplyConfiguredInitialLayout()')
  );
  const senderRun = launch.indexOf("Run BrowserExe ' --new-window");
  const senderReady = launch.indexOf('WaitForLifecycleTitle("sender", g_senderProvider, g_sessionId, "ready"');
  const receiverRun = launch.indexOf("Run BrowserExe ' --new-window", senderRun + 1);
  assert.ok(senderRun >= 0);
  assert.ok(senderReady > senderRun);
  assert.ok(receiverRun > senderReady);
});

test('launcher sends boot context through the sender transport without local sender submission', () => {
  const launch = launcher.slice(
    launcher.indexOf('RunManagedLaunch(reuseSession := false)'),
    launcher.indexOf('RepairLaunch(*)')
  );
  assert.match(launch, /SendToWindow\(BuildBootPrompt\(\), "\^\+\{F5\}", g_hWin1\)/);
  assert.doesNotMatch(launch, /SendToWindow\(BuildBootPrompt\(\), "\^\+\{F7\}", g_hWin2\)/);
});

test('Alt+Delete asks the extension to close the exact session before Win32 fallback', () => {
  const endStart = launcher.indexOf('EndActiveSession() {');
  const endBlock = launcher.slice(endStart, launcher.indexOf('; Alt+E', endStart));
  assert.match(endBlock, /SendToWindow\("", "\^\+\{F4\}"/);
  assert.match(endBlock, /CloseManagedPmiaWindows\(\)/);
  assert.ok(endBlock.indexOf('^+{F4}') < endBlock.indexOf('CloseManagedPmiaWindows()'));
});

test('composer readiness uses a long watchdog without slowing successful launches', () => {
  assert.match(launcher, /COMPOSER_READY_TIMEOUT_MS\s*:=\s*60000/);
  const waitBlock = launcher.slice(
    launcher.indexOf('WaitForLifecycleTitle(role, provider, sessionId, phase, timeoutMs)'),
    launcher.indexOf('DiagnoseLaunchFailure', launcher.indexOf('WaitForLifecycleTitle(role, provider, sessionId, phase, timeoutMs)'))
  );
  assert.match(waitBlock, /Sleep 100/);
  const launch = launcher.slice(
    launcher.indexOf('RunManagedLaunch(reuseSession := false)'),
    launcher.indexOf('ApplyConfiguredInitialLayout()')
  );
  assert.match(launch, /"ready", COMPOSER_READY_TIMEOUT_MS/);
  assert.doesNotMatch(launch, /"ready", 30000/);
});

test('runtime boot and registration use event-driven long watchdogs without fixed delay', () => {
  assert.match(launcher, /RUNTIME_LIFECYCLE_TIMEOUT_MS\s*:=\s*60000/);
  const launch = launcher.slice(
    launcher.indexOf('RunManagedLaunch(reuseSession := false)'),
    launcher.indexOf('ApplyConfiguredInitialLayout()')
  );
  for (const role of ['sender', 'receiver']) {
    assert.match(launch, new RegExp(`WaitForLifecycleTitle\\("${role}", g_${role}Provider, g_sessionId, "boot", RUNTIME_LIFECYCLE_TIMEOUT_MS\\)`));
    assert.match(launch, new RegExp(`WaitForLifecycleTitle\\("${role}", g_${role}Provider, g_sessionId, "registered", RUNTIME_LIFECYCLE_TIMEOUT_MS\\)`));
  }
  assert.doesNotMatch(launch, /"(?:boot|registered)", 15000/);
  const waitBlock = launcher.slice(
    launcher.indexOf('WaitForLifecycleTitle(role, provider, sessionId, phase, timeoutMs)'),
    launcher.indexOf('DiagnoseLaunchFailure', launcher.indexOf('WaitForLifecycleTitle(role, provider, sessionId, phase, timeoutMs)'))
  );
  assert.match(waitBlock, /Sleep 100/);
});
test('session studio captures structured PM metadata without persisting it', () => {
  for (const label of [
    'Target company', 'Target role', 'Interview round',
    'Emphasis', 'Avoid mentioning', 'Answer mode', 'Additional notes'
  ]) assert.match(launcher, new RegExp(label));
  for (const globalName of [
    'g_sessionCompany', 'g_sessionRole', 'g_sessionRound',
    'g_sessionEmphasis', 'g_sessionAvoid', 'g_sessionAnswerMode'
  ]) assert.match(launcher, new RegExp(globalName));
  assert.match(launcher, /BuildSessionMetadataBlock\(\)/);
  assert.match(launcher, /Company:\s*"/);
  assert.match(launcher, /Target role:\s*"/);
  assert.match(launcher, /Interview round:\s*"/);
  assert.match(launcher, /Emphasis:\s*"/);
  assert.match(launcher, /Avoid mentioning:\s*"/);
  assert.match(launcher, /Answer mode:\s*"/);
  const saveBlock = block('SaveStudioPreferences()', 'RunProfileDoctor(');
  assert.doesNotMatch(saveBlock, /Company|Role|Round|Emphasis|Avoid|AnswerMode|Notes/);
});

test('structured metadata controls are read for launch and released on close', () => {
  const launchBlock = block('StartLaunchFromGui(*)', 'CloseSessionLaunchGui(*)');
  const closeBlock = block('CloseSessionLaunchGui(*)', 'AutoStartup() {');
  for (const control of [
    'g_companyEdit', 'g_roleEdit', 'g_roundDdl', 'g_emphasisDdl',
    'g_avoidEdit', 'g_answerModeDdl', 'g_metaEdit'
  ]) {
    assert.match(launchBlock, new RegExp(control));
    assert.match(closeBlock, new RegExp(`${control}\\s*:=\\s*0`));
  }
  assert.match(launcher, /Show\("w960 h900"\)/);
});
