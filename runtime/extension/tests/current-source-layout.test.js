import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runtimeRoot = resolve(extensionRoot, '..');
const repoRoot = resolve(runtimeRoot, '..');

async function exists(relative) {
  try {
    await access(resolve(repoRoot, relative), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const removedLegacyPaths = [
  'archive',
  'drafts',
  'runtime/Final_2_Window_Fixed.ahk',
  'runtime/tm_scripts',
  'runtime/tm_update_support',
  'runtime/patches',
  'runtime/scripts/New-PMIACurrentDeployment.ps1',
  'runtime/scripts/New-PMIAInstalledArchive.ps1',
  'runtime/scripts/Test-PMIADeployment.ps1'
];

test('repository contains one current direct-source runtime', async () => {
  for (const relative of removedLegacyPaths) {
    assert.equal(await exists(relative), false, `${relative} must not return to the current tree`);
  }
  assert.equal(await exists('runtime/extension/manifest.json'), true);
  assert.equal(await exists('runtime/Final_2_Window_Extension.ahk'), true);
  assert.equal(await exists('runtime/Validate_Extension_Runtime.ps1'), true);
});

test('active documentation and Review Studio use the canonical source root', async () => {
  const deployment = await readFile(resolve(repoRoot, 'DEPLOYMENT_GUIDE.md'), 'utf8');
  const tracker = await readFile(resolve(repoRoot, 'runtime/Session_Tracker_End_Session.ahk'), 'utf8');
  const ignore = await readFile(resolve(repoRoot, '.gitignore'), 'utf8');
  assert.match(deployment, /product-pm-interview-assistant-instructions\\runtime\\extension/);
  assert.doesNotMatch(deployment, /PMIA Deployment|pmia-0\.6\.1-installed/);
  assert.match(tracker, /A_ScriptDir "\\\.\.\\\.local\\session-tracker"/);
  assert.match(ignore, /^\.local\/$/m);
});
