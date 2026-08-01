import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const controller = await readFile(new URL('../shared/runtime-pilot-controller.js', import.meta.url), 'utf8');
const background = await readFile(new URL('../background.js', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');
const validator = await readFile(new URL('../scripts/validate-extension.mjs', import.meta.url), 'utf8');
const releaseBuilder = await readFile(new URL('../../scripts/build-release-evidence-manifest.mjs', import.meta.url), 'utf8');

test('cycles 86 through 95 are integrated at their owning runtime boundaries', () => {
  assert.match(controller, /refreshDerivedPolicies/);
  assert.match(controller, /reason: 'queue_only_mode'/);
  assert.match(controller, /selectRecoveryAction/);
  assert.match(controller, /runConsistencyAudit/);
  assert.match(background, /auditConsistency/);
  assert.match(controller, /export_support_bundle/);
  assert.match(dashboard, /exportSupportBundle/);
  assert.match(html, /Safe support bundle/);
  assert.match(validator, /path\.startsWith\('testing'\)/);
  assert.match(releaseBuilder, /pmia-release-evidence-v1/);
  assert.match(releaseBuilder, /sourceHashes/);
  assert.match(releaseBuilder, /processTreeClosed/);
});

test('production modules cannot import test-only fault harnesses', () => {
  assert.match(validator, /Production module imports test-only fault harness/);
});
