import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const launcherPath = resolve(extensionRoot, '..', 'Final_2_Window_Extension.ahk');
const launcher = await readFile(launcherPath, 'utf8');

test('launcher forces fresh Default-profile Edge app windows', () => {
  assert.match(launcher, /--profile-directory=\\?"Default\\?"/);
  assert.match(launcher, /--new-window/);
  assert.match(launcher, /--app=/);
});

test('launcher closes only managed PMIA windows before a new session', () => {
  assert.match(launcher, /CloseManagedPmiaWindows\(\)/);
  assert.match(launcher, /\^PMIA_\(SENDER\|RECEIVER\)_\(CHATGPT\|CLAUDE\)_/);
  assert.match(launcher, /WinGetList\("ahk_exe msedge\.exe"\)/);
  assert.doesNotMatch(launcher, /taskkill|ProcessClose\("msedge\.exe"\)/i);
});

test('launcher retains exact session-suffixed window detection', () => {
  assert.match(launcher, /RuntimeWindowTitle\("sender", g_senderProvider, g_sessionId\)/);
  assert.match(launcher, /RuntimeWindowTitle\("receiver", g_receiverProvider, g_sessionId\)/);
  assert.match(launcher, /WinWait\(senderTitle/);
  assert.match(launcher, /WinWait\(receiverTitle/);
});

test('Alt+E exports sender and receiver role-scoped records', () => {
  const exportBlock = launcher.match(/!e:: \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(exportBlock, /global g_hWin1, g_hWin2/);
  assert.match(exportBlock, /SendToWindow\("", "\^\+\{F8\}", g_hWin1\)/);
  assert.match(exportBlock, /SendToWindow\("", "\^\+\{F8\}", g_hWin2\)/);
  assert.match(exportBlock, /sender export/);
  assert.match(exportBlock, /receiver export/);
});

test('launcher opens a branded session studio on startup', () => {
  assert.match(launcher, /ShowSessionLaunchGui\(\)/);
  assert.match(launcher, /PM Interview Assistant — Session Studio/);
  assert.match(launcher, /Build your live interview workspace/);
  assert.match(launcher, /Launch Interview/);
});

test('session studio provides route feedback and fast provider swapping', () => {
  assert.match(launcher, /g_routeSummary/);
  assert.match(launcher, /UpdateLaunchRouteSummary/);
  assert.match(launcher, /SwapLaunchProviders/);
  assert.match(launcher, /OnEvent\("Change", UpdateLaunchRouteSummary\)/);
  assert.match(launcher, /Resume, JD, and notes stay in memory/);
});

test('session studio reports context readiness before launch', () => {
  assert.match(launcher, /g_contextStatus/);
  assert.match(launcher, /UpdateLaunchContextStatus/);
  assert.match(launcher, /Resume.*characters/);
  assert.match(launcher, /Job description.*characters/i);
});

test('launcher stores diagnostics outside the repository', () => {
  assert.match(launcher, /EnvGet\("LOCALAPPDATA"\)\s+"\\PMInterviewAssistant\\logs"/);
  assert.doesNotMatch(launcher, /A_ScriptDir\s+"\\runtime_logs"/);
  assert.match(launcher, /DirCreate LOG_DIR/);
});

test('startup studio avoids timer races during prompt initialization', () => {
  assert.doesNotMatch(launcher, /SetTimer ShowSessionLaunchGui/);
});

test('startup studio opens synchronously before hotkeys become active', () => {
  const startupCallIndex = launcher.indexOf('ShowSessionLaunchGui()');
  const firstHotkeyIndex = launcher.indexOf('~LAlt::return');
  assert.ok(startupCallIndex >= 0);
  assert.ok(startupCallIndex < firstHotkeyIndex);
});

test('closing the session studio releases every control reference', () => {
  const closeBlock = launcher.slice(
    launcher.indexOf('CloseSessionLaunchGui(*)'),
    launcher.indexOf('AutoStartup() {')
  );
  for (const control of [
    'g_launchGui', 'g_resumeEdit', 'g_jdEdit', 'g_metaEdit',
    'g_senderProviderDdl', 'g_receiverProviderDdl', 'g_routeSummary',
    'g_contextStatus', 'g_launchStatus', 'g_launchButton'
  ]) {
    assert.match(closeBlock, new RegExp(`${control}\\s*:=\\s*0`));
  }
});

test('short-context confirmation is owned by the session studio', () => {
  const launchBlock = launcher.slice(
    launcher.indexOf('StartLaunchFromGui(*)'),
    launcher.indexOf('CloseSessionLaunchGui(*)')
  );
  const ownerIndex = launchBlock.indexOf('g_launchGui.Opt("+OwnDialogs")');
  const confirmIndex = launchBlock.indexOf('MsgBox("Resume or JD looks too short. Continue anyway?"');
  assert.ok(ownerIndex >= 0, 'Session Studio must own its confirmation dialog');
  assert.ok(confirmIndex > ownerIndex, 'dialog ownership must be set before MsgBox');
});


test('session studio owns validation dialogs so they cannot open behind the launcher', () => {
  assert.match(launcher, /Gui\("[^"]*\+OwnDialogs[^"]*",\s*"PM Interview Assistant/);
  assert.match(launcher, /MsgBox\("Resume or JD looks too short\. Continue anyway\?"/);
});
