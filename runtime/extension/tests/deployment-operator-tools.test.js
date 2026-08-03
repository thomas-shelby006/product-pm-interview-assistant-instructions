import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const scriptsRoot = resolve(testsRoot, '../../scripts');
const read = name => readFile(resolve(scriptsRoot, name), 'utf8');

test('readiness report verifies packages and exposes four release lanes', async () => {
  const source = await read('Get-PMIADeploymentReadiness.ps1');
  assert.match(source, /Test-PMIADeployment\.ps1/);
  assert.match(source, /CURRENT_PACKAGE_INVALID/);
  assert.match(source, /ROLLBACK_ARCHIVE_INVALID/);
  assert.match(source, /EXTENSION_VERSION_MISMATCH/);
  assert.match(source, /EXTENSION_PATH_MISMATCH/);
  assert.match(source, /AUTOHOTKEY_V2_MISSING/);
  assert.match(source, /pmia-deployment-readiness\/v2/);
  assert.match(source, /ReleaseEvidencePath/);
  assert.match(source, /deterministicBrowser/);
  assert.match(source, /providerCanary/);
  assert.match(source, /normalProfileActivation/);
  assert.match(source, /activationReady/);
});

test('Edge deployment helper is reload-first and never mutates browser preferences', async () => {
  const source = await read('Open-PMIAEdgeDeployment.ps1');
  assert.match(source, /edge:\/\/extensions/);
  assert.match(source, /action = 'reload'/);
  assert.match(source, /Load unpacked/);
  assert.match(source, /Set-Clipboard/);
  assert.doesNotMatch(source, /Set-Content[^\n]*(?:Preferences|Secure Preferences)/i);
  assert.doesNotMatch(source, /reg(?:\.exe)?\s+(?:add|delete)/i);
});

test('inventory derives four-lane status from evidence and retained layout', async () => {
  const source = await read('New-PMIADeploymentInventory.ps1');
  assert.match(source, /Get-PMIADeploymentReadiness\.ps1/);
  assert.match(source, /deployment-manifest\.json/);
  assert.match(source, /release-evidence-manifest\.json/);
  assert.match(source, /worktree-integration-manifest\.json/);
  assert.match(source, /pmia-deployment-inventory\/v3/);
  assert.match(source, /releaseVerification/);
  assert.match(source, /packageReady/);
  assert.match(source, /activationReady/);
  assert.match(source, /remainingDeploymentEntries/);
  assert.match(source, /RetainEvidencePath/);
  assert.match(source, /rawEvidenceRetained/);
  assert.match(source, /onlyMainBranch/);
  assert.match(source, /onlyMainWorktree/);
});
