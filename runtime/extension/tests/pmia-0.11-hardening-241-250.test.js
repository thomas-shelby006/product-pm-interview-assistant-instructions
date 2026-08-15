import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runtime=resolve(root,'..');
const runner=await readFile(resolve(runtime,'scripts','isolated-release-smoke.mjs'),'utf8');
const smokeTest=await readFile(resolve(root,'tests','isolated-release-smoke.test.js'),'utf8');
const launcher=await readFile(resolve(runtime,'Final_2_Window_Extension.ahk'),'utf8');
const controller=await readFile(resolve(root,'shared','runtime-pilot-controller.js'),'utf8');


test('Cycles 241-244: smoke waits for durable ownership between manual-copy finals', () => {
  assert.match(runner,/manualCopyAndAwaitOwnership/);
  assert.match(runner,/manualCopyAdmissions:\s*\[\]/);
  assert.match(runner,/Q2 admitted to durable ownership|\$\{label\} admitted to durable ownership/);
  assert.match(smokeTest,/admits each manual-copy final before injecting the next one/);
});
test('Cycles 245-247: dashboard export returns verified role results rather than scheduled success', () => {
  const start=controller.indexOf("case 'export_session':");
  const end=controller.indexOf("case 'export_support_bundle':",start);
  const block=controller.slice(start,end);
  assert.match(block,/const roleExport = await exportManagedSession/);
  assert.match(block,/result = \{ \.\.\.roleExport, analysis \}/);
  assert.doesNotMatch(block,/scheduled:\s*true|setTimeout/);
});

test('Cycles 248-250: graceful shutdown verifies dashboard ownership and no broad cleanup path remains', () => {
  const start=launcher.indexOf('ObserveManagedShutdown(attempt)');
  const end=launcher.indexOf('; Alt+E',start);
  const block=launcher.slice(start,end);
  assert.match(block,/CloseExactManagedWindow\(g_hDashboard, g_sessionId, g_browserConfig\["executable"\]\)/);
  assert.match(block,/dashboard ownership could not be verified/);
  assert.doesNotMatch(launcher,/CloseManagedPmiaWindows\(/);
  assert.match(launcher,/ExitApp/);
});
