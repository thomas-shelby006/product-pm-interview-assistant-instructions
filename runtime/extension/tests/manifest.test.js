import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readManifest() {
  try {
    return JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  } catch {
    return null;
  }
}

test('manifest is MV3 and registers module service worker', async () => {
  const manifest = await readManifest();
  assert.ok(manifest, 'manifest.json must exist');
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.background, { service_worker: 'background.js', type: 'module' });
});

test('manifest grants only required provider hosts and storage', async () => {
  const manifest = await readManifest();
  assert.ok(manifest, 'manifest.json must exist');
  assert.deepEqual(manifest.permissions.sort(), ['storage', 'tabs'].sort());
  assert.deepEqual(manifest.host_permissions.sort(), [
    'https://chat.openai.com/*',
    'https://chatgpt.com/*',
    'https://claude.ai/*'
  ].sort());
});

test('content script runs on ChatGPT and Claude pages', async () => {
  const manifest = await readManifest();
  assert.ok(manifest, 'manifest.json must exist');
  const script = manifest.content_scripts[0];
  assert.deepEqual(script.matches.sort(), [
    'https://chat.openai.com/*',
    'https://chatgpt.com/*',
    'https://claude.ai/*'
  ].sort());
  assert.deepEqual(script.js, ['content/main.js']);
});
