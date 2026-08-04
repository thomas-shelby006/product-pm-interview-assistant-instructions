import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReleaseIdentity } from '../shared/release-identity.js';
import { buildHandoffManifest } from '../shared/release-handoff.js';

const extensionRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runtimeRoot = resolve(extensionRoot, '..');
const repoRoot = resolve(runtimeRoot, '..');
const read = relative => readFile(resolve(repoRoot, relative), 'utf8');

const activeDocuments = [
  'README.md',
  'AI_SYSTEM_CONTEXT.md',
  'DEPLOYMENT_GUIDE.md',
  'runtime/README_INSTALL_TEST.md',
  'runtime/extension/README.md',
  'docs/SESSION_TRACKER_SETUP.md'
];

test('active release surfaces identify PMIA 0.10.4', async () => {
  const manifest = JSON.parse(await readFile(resolve(extensionRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, '0.10.4');
  for (const relative of activeDocuments) {
    assert.match(await read(relative), /0\.10\.4/, `${relative} must identify 0.10.4`);
  }
  assert.equal(buildReleaseIdentity().version, '0.10.4');
  assert.equal(buildHandoffManifest().version, '0.10.4');
});

test('deployment guide uses Reload before Load unpacked', async () => {
  const guide = await read('DEPLOYMENT_GUIDE.md');
  const reloadIndex = guide.indexOf('**Reload**');
  const loadIndex = guide.indexOf('**Load unpacked**');
  assert.ok(reloadIndex >= 0, 'Reload instruction is required');
  assert.ok(loadIndex >= 0, 'Load unpacked fallback is required');
  assert.ok(reloadIndex < loadIndex, 'Reload must be the primary path');
  assert.match(guide, /product-pm-interview-assistant-instructions\\runtime\\extension/);
  assert.match(guide, /EXTENSION_VERSION_MISMATCH/);
  assert.match(guide, /pathMatches.*True/i);
});
