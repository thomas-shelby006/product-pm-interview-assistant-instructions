import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = resolve(extensionRoot, '..');
const repoRoot = resolve(runtimeRoot, '..');
const read = (path) => readFile(resolve(repoRoot, path), 'utf8');

test('release surfaces identify PMIA runtime 0.6.1', async () => {
  const manifest = JSON.parse(await readFile(resolve(extensionRoot, 'manifest.json'), 'utf8'));
  const rootReadme = await read('README.md');
  const extensionReadme = await read('runtime/extension/README.md');
  assert.equal(manifest.version, '0.6.1');
  assert.match(rootReadme, /0\.6\.1/);
  assert.match(extensionReadme, /Runtime 0\.6\.1/);
});

test('active docs describe structured memory-only session setup', async () => {
  const docs = [
    await read('README.md'),
    await read('runtime/README_INSTALL_TEST.md'),
    await read('runtime/extension/README.md')
  ].join('\n');
  for (const label of ['Target company', 'Target role', 'Interview round', 'Emphasis', 'Avoid mentioning', 'Answer mode']) {
    assert.match(docs, new RegExp(label));
  }
  assert.match(docs, /memory-only/i);
  assert.match(docs, /not persisted/i);
});

test('tracker documentation matches the Edge Stable extension-native workflow', async () => {
  const setup = await read('docs/SESSION_TRACKER_SETUP.md');
  const status = await read('docs/CURRENT_STATUS_DASHBOARD.md');
  const handoff = await read('docs/CURRENT_SETUP_HANDOFF_AND_REQUIREMENTS.md');
  for (const doc of [setup, status, handoff]) {
    assert.match(doc, /Microsoft Edge Stable/);
    assert.match(doc, /Manifest V3/);
  }
  assert.match(setup, /PMIA_RUNTIME_CONTROL_V1/);
  assert.match(setup, /Export and Pair/);
  assert.match(setup, /one fresh sender and one fresh receiver/);
  assert.match(setup, /auto-merge/i);
  assert.doesNotMatch(setup, /## Edge Beta setup|Tampermonkey.*enabled/i);
});

test('historical phase documents no longer claim shipped work is deferred', async () => {
  const phase = await read('AHK_PHASE_2_IMPLEMENTATION_PLAN.md');
  const review = await read('ARCHITECTURE_FIRST_PRINCIPLES_REVIEW.md');
  const boot = await read('project_source_files/PM_BOOT_PROMPT_FOR_AHK.md');
  assert.match(phase, /Status: completed in PMIA runtime 0\.6\.1/i);
  assert.match(review, /structured session setup.*implemented/i);
  assert.match(review, /interrupt.*implemented/i);
  assert.doesNotMatch(boot, /structured \*\*dropdown\*\* version.*deferred/is);
});

test('project upload bundle identifies the active extension runtime', async () => {
  const runtime = await read('project_upload_bundle/03_SESSION_RUNTIME_AND_CONTEXT.md');
  const manifest = await read('project_upload_bundle/PROJECT_UPLOAD_BUNDLE_MANIFEST.md');
  assert.match(runtime, /Manifest V3/);
  assert.match(runtime, /Edge Stable/);
  assert.doesNotMatch(runtime, /Live runtime \(AHK two-window \+ Tampermonkey bridge\)/);
  assert.match(manifest, /Manifest V3 extension/);
});
