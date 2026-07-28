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