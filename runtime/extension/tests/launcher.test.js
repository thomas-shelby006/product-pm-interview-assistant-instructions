import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const launcherPath = resolve(extensionRoot, '..', 'Final_2_Window_Extension.ahk');
const launcher = await readFile(launcherPath, 'utf8');
const validator = await readFile(resolve(extensionRoot, '..', 'Validate_Extension_Runtime.ps1'), 'utf8');

function block(start, end) {
  const startIndex = launcher.indexOf(start);
  const endIndex = launcher.indexOf(end, startIndex + start.length);
  return startIndex >= 0 && endIndex > startIndex ? launcher.slice(startIndex, endIndex) : '';
}

test('launcher supports environment validation before normal runtime ownership', () => {
  assert.match(launcher, /EnvGet\("PMIA_VALIDATE"\) = "1"/);
  assert.match(validator, /Main launcher' -UseEnvironmentValidation/);
});

test('launcher completes validation and startup before platform function declarations or hotkeys', () => {
  const validation = launcher.indexOf('EnvGet("PMIA_VALIDATE") = "1"');
  const monitor = launcher.indexOf('SetTimer MonitorManagedSession, 2000');
  const firstHotkey = launcher.indexOf('~LAlt::return');
  const platformInclude = launcher.indexOf('PMIA_Runtime_Platform.ahk');
  assert.ok(validation >= 0);
  assert.ok(monitor > validation);
  assert.ok(firstHotkey > monitor);
  assert.ok(platformInclude > monitor);
  assert.ok(platformInclude < firstHotkey);
});

test('launcher uses a configurable Chromium-family platform with Edge as the safe default', async () => {
  const platform = await readFile(resolve(extensionRoot, '..', 'PMIA_Runtime_Platform.ahk'), 'utf8');
  assert.match(launcher, /LoadBrowserRuntimeConfig\(SETTINGS_FILE\)/);
  assert.match(launcher, /LaunchPmiaBrowserWindow\(g_browserConfig/);
  assert.match(platform, /NormalizeBrowserFamily/);
  for (const family of ['edge','chrome','brave','vivaldi']) assert.match(platform, new RegExp(`"${family}"`));
  assert.match(platform, /--profile-directory=/);
  assert.match(platform, /--new-window --app=/);
  assert.doesNotMatch(launcher, /Edge Beta|Canary/);
});

test('launcher closes only exact journal-owned PMIA windows', async () => {
  const platform = await readFile(resolve(extensionRoot, '..', 'PMIA_Runtime_Platform.ahk'), 'utf8');
  assert.match(launcher, /CloseOwnedManagedRuntime\(/);
  assert.match(platform, /ManagedWindowMatchesOwnership/);
  assert.match(platform, /window_ownership_mismatch/);
  assert.match(platform, /WinGetProcessPath/);
  assert.doesNotMatch(launcher, /taskkill|ProcessClose\([^)]*browser|CloseManagedPmiaWindows/i);
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

test('preflight waits for the configured browser to persist a path-matched extension version reload', () => {
  assert.match(launcher, /WaitForSelectedProfileReady\(timeoutMs := 15000\)/);
  const settleBlock = block('WaitForSelectedProfileReady(timeoutMs := 15000)', 'NormalizeProvider(value)');
  assert.match(settleBlock, /EXTENSION_VERSION_MISMATCH/);
  assert.match(settleBlock, /Sleep 500/);
  const preflightBlock = block('RunStudioPreflight(*)', 'FindLifecycleWindow(');
  assert.match(preflightBlock, /WaitForSelectedProfileReady\(\)/);
});
test('managed-window discovery includes hidden windows and restores detection state', () => {
  const findBlock = block('FindLifecycleWindow(role, provider, sessionId, minimumPhase := "boot")', 'WaitForLifecycleTitle(');
  assert.match(findBlock, /previousDetectHidden := A_DetectHiddenWindows/);
  assert.match(findBlock, /DetectHiddenWindows true/);
  assert.match(findBlock, /DetectHiddenWindows previousDetectHidden/);
});
test('new launches use verified journal cleanup and never fall back to broad title scans', () => {
  const launchBlock = block('RunManagedLaunch(reuseSession := false)', 'ApplyConfiguredInitialLayout()');
  assert.match(launchBlock, /CloseOwnedManagedRuntime\(reuseSession \? g_sessionId : ""\)/);
  assert.match(launchBlock, /OWNERSHIP_MISMATCH/);
  assert.match(launchBlock, /WriteManagedRuntimeJournal\(g_sessionId, g_browserConfig\)/);
  assert.doesNotMatch(launchBlock, /CloseManagedPmiaWindows/);
});
test('session studio exposes configurable browser health and operational actions', () => {
  assert.match(launcher, /PM Interview Assistant — Session Studio/);
  assert.match(launcher, /g_browserFamilyDdl/);
  assert.match(launcher, /Browser settings/);
  assert.match(launcher, /"Preflight"/);
  assert.match(launcher, /"Repair"/);
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

test('repair opens the configured browser extension page without editing browser preferences', () => {
  assert.match(launcher, /BrowserExtensionsUrl\(g_browserConfig/);
  assert.match(launcher, /LaunchPmiaBrowserPage\(g_browserConfig, g_selectedProfileDirectory/);
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
    'g_browserFamilyDdl', 'g_browserSummary', 'g_browserSettingsGui',
    'g_routeSummary', 'g_contextStatus', 'g_launchStatus',
    'g_runtimeHealth', 'g_preflightButton', 'g_repairButton', 'g_liveCheckButton', 'g_launchButton'
  ]) assert.match(closeBlock, new RegExp(`${control}\\s*:=\\s*0`));
});

test('Alt+E triggers the browser-level PMIA export command on the recovered sender window', () => {
  const exportBlock = launcher.slice(launcher.indexOf('ExportActiveSession() {'), launcher.indexOf('; Alt+Q'));
  assert.match(exportBlock, /IsActiveSession\(\)/);
  assert.match(exportBlock, /SendBrowserCommand\("\^\+8", g_hWin1\)/);
  assert.doesNotMatch(exportBlock, /\^\+\{F8\}/);
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

test('launcher waits for composer readiness without foregrounding provider windows', () => {
  const launch = launcher.slice(
    launcher.indexOf('RunManagedLaunch(reuseSession := false)'),
    launcher.indexOf('ApplyConfiguredInitialLayout() {', launcher.indexOf('RunManagedLaunch(reuseSession := false)'))
  );
  const senderRegistered = launch.indexOf('senderRegistered :=');
  const senderReady = launch.indexOf('senderReady :=');
  const receiverRegistered = launch.indexOf('receiverRegistered :=');
  const receiverReady = launch.indexOf('receiverReady :=');
  assert.ok(senderRegistered >= 0 && senderReady > senderRegistered);
  assert.ok(receiverRegistered > senderReady && receiverReady > receiverRegistered);
  assert.doesNotMatch(launch.slice(senderRegistered, senderReady), /WinActivate/);
  assert.doesNotMatch(launch.slice(receiverRegistered, receiverReady), /WinActivate/);
});

test('Alt+Delete requests extension safety approval without direct window cleanup', () => {
  const hotkeyBlock = launcher.match(/!Delete:: \{[\s\S]*?\n\}/)?.[0] || '';
  const endStart = launcher.indexOf('EndActiveSession() {');
  const endBlock = launcher.slice(endStart, launcher.indexOf('; Alt+E', endStart));
  assert.match(hotkeyBlock, /EndActiveSession\(\)/);
  assert.match(endBlock, /IsActiveSession\(\)/);
  assert.match(endBlock, /SendBrowserCommandBackground\("\^\+\{F4\}", g_hWin1\)/);
  assert.match(endBlock, /ObserveManagedShutdown/);
  assert.doesNotMatch(endBlock, /CloseManagedPmiaWindows|WinActivate/);
});

test('launcher confirms sender readiness before opening the receiver window', () => {
  const launch = launcher.slice(
    launcher.indexOf('RunManagedLaunch(reuseSession := false)'),
    launcher.indexOf('ApplyConfiguredInitialLayout() {', launcher.indexOf('RunManagedLaunch(reuseSession := false)'))
  );
  const senderRun = launch.indexOf('LaunchPmiaBrowserWindow(g_browserConfig, g_selectedProfileDirectory, senderUrl');
  const senderReady = launch.indexOf('WaitForLifecycleTitle("sender", g_senderProvider, g_sessionId, "ready"');
  const receiverRun = launch.indexOf('LaunchPmiaBrowserWindow(g_browserConfig, g_selectedProfileDirectory, receiverUrl');
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

test('Alt+Delete scopes the safety request to the recovered sender handle', () => {
  const endStart = launcher.indexOf('EndActiveSession() {');
  const endBlock = launcher.slice(endStart, launcher.indexOf('; Alt+E', endStart));
  assert.ok(endBlock.indexOf('IsActiveSession()') < endBlock.indexOf('SendBrowserCommandBackground'));
  assert.match(endBlock, /global g_hWin1/);
  assert.match(endBlock, /SendBrowserCommandBackground\("\^\+\{F4\}", g_hWin1\)/);
  assert.doesNotMatch(endBlock, /CloseManagedPmiaWindows|chrome-extension:\/\//);
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
    launcher.indexOf('ApplyConfiguredInitialLayout() {', launcher.indexOf('RunManagedLaunch(reuseSession := false)'))
  );
  assert.match(launch, /"ready", COMPOSER_READY_TIMEOUT_MS/);
  assert.doesNotMatch(launch, /"ready", 30000/);
});

test('runtime boot and registration use event-driven long watchdogs without fixed delay', () => {
  assert.match(launcher, /RUNTIME_LIFECYCLE_TIMEOUT_MS\s*:=\s*60000/);
  const launch = launcher.slice(
    launcher.indexOf('RunManagedLaunch(reuseSession := false)'),
    launcher.indexOf('ApplyConfiguredInitialLayout() {', launcher.indexOf('RunManagedLaunch(reuseSession := false)'))
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

test('operational session recovery binds one unambiguous READY lifecycle pair when cached state is stale', () => {
  assert.match(launcher, /RecoverUnambiguousManagedSession\(\)/);
  const recoverStart = launcher.indexOf('RecoverUnambiguousManagedSession() {');
  const recoverEnd = launcher.indexOf('\n}\n\nIsAlive(', recoverStart);
  const recoverBlock = launcher.slice(recoverStart, recoverEnd);
  assert.match(recoverBlock, /browserExeName := RegExReplace\(g_browserConfig\["executable"\]/);
  assert.match(recoverBlock, /WinGetList\("ahk_exe " browserExeName\)/);
  assert.match(recoverBlock, /\^PMIA_\(SENDER\|RECEIVER\)_\(CHATGPT\|CLAUDE\)_\(PMIA_/);
  assert.match(recoverBlock, /completeSessions\.Length != 1/);
  assert.match(recoverBlock, /g_sessionId\s*:=\s*StrLower/);
  assert.match(recoverBlock, /g_senderProvider\s*:=\s*StrLower/);
  assert.match(recoverBlock, /g_receiverProvider\s*:=\s*StrLower/);
  assert.match(recoverBlock, /g_hWin1\s*:=/);
  assert.match(recoverBlock, /g_hWin2\s*:=/);
  assert.match(recoverBlock, /UpdateManagedRuntimeJournal/);
});

test('handle refresh falls back to unambiguous lifecycle recovery after cached lookup fails', () => {
  const start = launcher.indexOf('RefreshManagedWindowHandles() {');
  const end = launcher.indexOf('\n}\n\nRecoverUnambiguousManagedSession() {', start);
  const block = launcher.slice(start, end);
  assert.match(block, /RecoverUnambiguousManagedSession\(\)/);
  assert.match(block, /return true/);
});

test('lifecycle lookup includes hidden Edge app windows and restores detection mode', () => {
  const start = launcher.indexOf('FindLifecycleWindow(role, provider, sessionId, minimumPhase := "boot") {');
  const end = launcher.indexOf('\n}\n\nWaitForLifecycleTitle(', start);
  const block = launcher.slice(start, end);
  assert.match(block, /previousDetectHidden := A_DetectHiddenWindows/);
  assert.match(block, /DetectHiddenWindows true/);
  assert.match(block, /finally/);
  assert.match(block, /DetectHiddenWindows previousDetectHidden/);
});

test('managed window liveness is independent of hidden-window detection', () => {
  const start = launcher.indexOf('IsAlive(hWnd) {');
  const end = launcher.indexOf('\n}\n\nSendToWindow(', start);
  const block = launcher.slice(start, end);
  assert.match(block, /DllCall\("IsWindow", "Ptr", hWnd, "Int"\)/);
  assert.doesNotMatch(block, /WinExist/);
});

test('focus-dependent window actions include hidden managed windows and restore detection mode', () => {
  const start = launcher.indexOf('SendToWindow(msg, shortcut, hTarget) {');
  const block = launcher.slice(start);
  assert.match(block, /previousDetectHidden := A_DetectHiddenWindows/);
  assert.match(block, /DetectHiddenWindows true/);
  assert.match(block, /DetectHiddenWindows previousDetectHidden/);
  assert.match(block, /WinActivate "ahk_id " hTarget/);
});


test('review control messages reuse export and safety-gated shutdown operations', () => {
  const exportBlock = launcher.slice(launcher.indexOf('ExportActiveSession() {'), launcher.indexOf('; Alt+Q'));
  assert.match(exportBlock, /SendBrowserCommand\("\^\+8", g_hWin1\)/);
  const endStart = launcher.indexOf('EndActiveSession() {');
  const endBlock = launcher.slice(endStart, launcher.indexOf('; Alt+E', endStart));
  assert.match(endBlock, /SendBrowserCommandBackground\("\^\+\{F4\}", g_hWin1\)/);
  assert.doesNotMatch(endBlock, /CloseManagedPmiaWindows/);
});

test('browser command activation includes hidden managed windows and restores detection mode', () => {
  const start = launcher.indexOf('SendBrowserCommand(shortcut, hTarget) {');
  const end = launcher.indexOf('SendToWindow(msg, shortcut, hTarget) {', start);
  const block = launcher.slice(start, end);
  assert.match(block, /DetectHiddenWindows true/);
  assert.match(block, /WinActivate "ahk_id " hTarget/);
  assert.match(block, /Send shortcut/);
  assert.match(block, /DetectHiddenWindows previousDetectHidden/);
});

test('launcher exposes one-key live health and fast repair controls', () => {
  assert.match(launcher, /!h::/);
  assert.match(launcher, /!\+r::/);
  assert.match(launcher, /Check Live/);
  assert.match(launcher, /Fast Repair/);
  assert.match(launcher, /CheckLiveSessionHealth\(/);
  assert.match(launcher, /FastRepairActiveSession\(/);
});

test('live health check uses the authoritative runtime preflight in both managed windows', () => {
  const start = launcher.indexOf('CheckLiveSessionHealth(*) {');
  const end = launcher.indexOf('FastRepairActiveSession(*) {', start);
  const health = launcher.slice(start, end);
  assert.match(health, /IsActiveSession\(\)/);
  assert.match(health, /SendToWindow\("", "\^\+\{F11\}", g_hWin1\)/);
  assert.match(health, /SendToWindow\("", "\^\+\{F11\}", g_hWin2\)/);
  assert.match(health, /SetLaunchState\("READY"/);
});

test('fast repair reuses the current in-memory route and session implementation', () => {
  const start = launcher.indexOf('FastRepairActiveSession(*) {');
  const end = launcher.indexOf('FocusRuntimeDashboard(*) {', start);
  const repair = launcher.slice(start, end);
  assert.match(repair, /ShowSessionLaunchGui\(\)/);
  assert.match(repair, /RepairLaunch\(\)/);
  assert.doesNotMatch(repair, /CreateSessionId|BuildBootPrompt|Run BrowserExe/);
});


test('launcher opens the Runtime Pilot Dashboard only after both provider roles are ready', () => {
  const launch = launcher.slice(
    launcher.indexOf('RunManagedLaunch(reuseSession := false)'),
    launcher.indexOf('ApplyConfiguredInitialLayout() {', launcher.indexOf('RunManagedLaunch(reuseSession := false)'))
  );
  const senderReady = launch.indexOf('senderReady :=');
  const receiverReady = launch.indexOf('receiverReady :=');
  const dashboardUrl = launch.indexOf('dashboardPageUrl := DashboardUrl');
  const dashboardWait = launch.indexOf('WaitForDashboardWindow');
  const bootSend = launch.indexOf('SendToWindow(BuildBootPrompt()');
  assert.ok(senderReady >= 0 && receiverReady > senderReady);
  assert.ok(dashboardUrl > receiverReady);
  assert.ok(dashboardWait > dashboardUrl);
  assert.ok(bootSend > dashboardWait);
  assert.match(launch, /WAITING_DASHBOARD/);
  assert.match(launch, /DASHBOARD_NOT_READY/);
});

test('dashboard lifecycle is session-scoped and uses the selected profile extension id', async () => {
  const platform = await readFile(resolve(extensionRoot, '..', 'PMIA_Runtime_Platform.ahk'), 'utf8');
  assert.match(launcher, /RuntimeDashboardTitle\(sessionId\)/);
  assert.match(launcher, /PMIA_DASHBOARD_/);
  assert.match(launcher, /DashboardUrl\(extensionId, g_sessionId\)/);
  assert.match(launcher, /g_selectedProfileRecord\["extensionId"\]/);
  assert.match(launcher, /LaunchPmiaBrowserWindow\(g_browserConfig, g_selectedProfileDirectory, dashboardPageUrl/);
  assert.match(platform, /--profile-directory=/);
  assert.match(platform, /--new-window --app=/);
});

test('launcher manages dashboard layout, hide, restore and exact journal cleanup', async () => {
  const platform = await readFile(resolve(extensionRoot, '..', 'PMIA_Runtime_Platform.ahk'), 'utf8');
  assert.match(launcher, /global g_hDashboard/);
  assert.match(launcher, /ApplyDashboardOnlyLayout\(\)/);
  assert.match(launcher, /DockDashboard\(\)/);
  assert.match(launcher, /dashboardVisible/);
  const hide = block('HideAllManaged() {', 'DockDashboard() {');
  assert.match(hide, /g_hDashboard/);
  assert.match(hide, /WinMove OFF_X/);
  assert.match(platform, /dashboardHwnd/);
  assert.match(platform, /CloseOwnedManagedRuntime/);
});

test('Alt+D focuses or reopens the current session dashboard without relaunching providers', () => {
  assert.match(launcher, /!d::FocusRuntimeDashboard\(\)/);
  const focus = block('FocusRuntimeDashboard(*) {', 'AutoStartup() {');
  assert.match(focus, /IsActiveSession\(\)/);
  assert.match(focus, /DashboardUrl/);
  assert.match(focus, /WaitForDashboardWindow/);
  assert.match(focus, /WinActivate "ahk_id " g_hDashboard/);
  assert.doesNotMatch(focus, /RunManagedLaunch/);
});

test('launcher clears sensitive in-memory context after both provider windows close', () => {
  assert.match(launcher, /SetTimer MonitorManagedSession, 2000/);
  const clear = block('ClearSessionMemory(reason := "session ended") {', 'MonitorManagedSession() {');
  for (const value of [
    'g_sessionResume', 'g_sessionJD', 'g_sessionMeta', 'g_sessionAvoid', 'g_sessionId'
  ]) assert.match(clear, new RegExp(`${value}\\s*:=\\s*""`));
  const monitor = block('MonitorManagedSession() {', 'IsActiveSession() {');
  assert.match(monitor, /sender\.Count \|\| receiver\.Count/);
  assert.match(monitor, /ClearSessionMemory/);
});


test('hide and restore preserve actual three-window geometry instead of replaying stale logical layout', () => {
  assert.match(launcher, /CaptureManagedGeometry\(\)/);
  assert.match(launcher, /RestoreManagedGeometry\(g_hiddenGeometry\)/);
  const toggle = block('ToggleHide() {', 'GhostWin1() {');
  assert.ok(toggle.indexOf('CaptureManagedGeometry()') < toggle.indexOf('HideAllManaged()'));
  assert.match(toggle, /if !RestoreManagedGeometry\(g_hiddenGeometry\)/);
  assert.match(toggle, /RestoreLayout\(g_hiddenLayout\)/);
});

test('session-memory cleanup requires a ten-second simultaneous provider absence', () => {
  const monitor = block('MonitorManagedSession() {', 'IsActiveSession() {');
  assert.match(monitor, /g_providerMissingSince/);
  assert.match(monitor, /sender\.Count \|\| receiver\.Count/);
  assert.match(monitor, />= 10000/);
  assert.match(monitor, /temporarily missing/);
});


test('persistent AutoHotkey debug logging is opt-in and session-redacted', () => {
  assert.match(launcher, /DEBUG_LOG_ENABLED\s*:=\s*EnvGet\("PMIA_DEBUG_LOG"\) = "1"/);
  const log = block('SanitizeLogMessage(message) {', 'ClearSessionMemory(');
  assert.match(log, /RegExReplace/);
  assert.match(log, /\[SESSION\]/);
  assert.match(log, /OutputDebug/);
  assert.match(log, /if !DEBUG_LOG_ENABLED\s*\n\s*return/);
  assert.ok(log.indexOf('if !DEBUG_LOG_ENABLED') < log.indexOf('FileAppend'));
});
