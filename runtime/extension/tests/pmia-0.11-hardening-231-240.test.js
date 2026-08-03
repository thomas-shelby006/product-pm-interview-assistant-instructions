import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runtime=resolve(root,'..');
const html=await readFile(resolve(root,'dashboard','index.html'),'utf8');
const launcher=await readFile(resolve(runtime,'Final_2_Window_Extension.ahk'),'utf8');
const platform=await readFile(resolve(runtime,'PMIA_Runtime_Platform.ahk'),'utf8');
const validator=await readFile(resolve(runtime,'Validate_Extension_Runtime.ps1'),'utf8');

function ids(source){return [...source.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);}

test('Cycles 231-233: Navigator DOM IDs are unique and every tab controls one panel', () => {
  const values=ids(html);assert.equal(new Set(values).size,values.length);
  for(const tab of ['Now','Search','Threads','Pace','Handoff','Workspaces','Scenarios','Bookmarks','Goals','Debrief']){
    assert.match(html,new RegExp(`id="navigatorTab${tab}"[^>]+aria-controls="navigatorPanel${tab}"`));
    assert.match(html,new RegExp(`id="navigatorPanel${tab}"[^>]+aria-labelledby="navigatorTab${tab}"`));
  }
});
test('Cycles 234-237: launch is focus-safe and journal cleanup is exact', () => {
  const start=launcher.indexOf('RunManagedLaunch(reuseSession := false)');
  const end=launcher.indexOf('ApplyConfiguredInitialLayout()',start);
  const block=launcher.slice(start,end);
  assert.doesNotMatch(block,/WinActivate/);
  assert.match(block,/SnapshotBrowserWindows\(g_browserConfig\)/);
  assert.match(block,/WaitForNewBrowserWindow\(g_browserConfig/);
  assert.match(block,/CloseOwnedManagedRuntime/);
  assert.doesNotMatch(block,/CloseManagedPmiaWindows/);
  assert.match(platform,/ManagedWindowMatchesOwnership/);
  assert.match(platform,/WinGetProcessPath/);
});

test('Cycles 238-240: platform smoke validates flags, journal ownership and unrelated-window preservation', () => {
  assert.match(platform,/--disable-background-timer-throttling/);
  assert.match(platform,/--disable-backgrounding-occluded-windows/);
  assert.match(platform,/--disable-renderer-backgrounding/);
  assert.match(platform,/"--disable-features", "--enable-features"/);
  assert.match(validator,/PMIA_Runtime_Platform_Smoke\.ahk/);
  assert.match(validator,/Resolve-AutoHotkeyV2/);
  assert.ok(validator.includes("^v2\\.\\d+\\.\\d+$"));
  assert.match(validator,/Sort-Object[\s\S]*Descending/);
  assert.match(validator,/Test-AutoHotkeyScript -Path \$platformSmoke/);
});
