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
  const script = manifest.content_scripts.find(item => item.js?.includes('content/main.js'));
  assert.deepEqual(script.matches.sort(), [
    'https://chat.openai.com/*',
    'https://chatgpt.com/*',
    'https://claude.ai/*'
  ].sort());
  assert.deepEqual(script.js, ['content/main.js']);
});


test('Claude voice observer runs in the main world before provider sockets open', async () => {
  const manifest = await readManifest();
  const script = manifest.content_scripts.find(item =>
    item.js?.includes('content/signals/claude-main.js')
  );
  assert.ok(script, 'Claude main-world signal observer must be registered');
  assert.deepEqual(script.matches, ['https://claude.ai/*']);
  assert.equal(script.world, 'MAIN');
  assert.equal(script.run_at, 'document_start');
});

test('Claude main-world observer ignores non-string WebSocket frames', async () => {
  const source = await readFile(
    new URL('../content/signals/claude-main.js', import.meta.url),
    'utf8'
  );
  assert.match(source, /typeof event\.data !== 'string'/);
  assert.doesNotMatch(source, /FileReader|arrayBuffer\(|base64/i);
});

test('manifest identifies the rearchitected runtime as a pre-live-validation release', async () => {
  const manifest = await readManifest();
  assert.equal(manifest.name, 'PM Interview Dual-Provider Runtime');
  assert.equal(manifest.version, '0.2.0');
  assert.match(manifest.description, /durable/i);
  assert.match(manifest.description, /voice/i);
});