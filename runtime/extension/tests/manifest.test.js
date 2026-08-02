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
  assert.deepEqual(manifest.permissions.sort(), ['alarms', 'storage', 'tabs', 'windows'].sort());
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

test('manifest identifies the low-latency preview/commit runtime', async () => {
  const manifest = await readManifest();
  assert.equal(manifest.name, 'PM Interview Dual-Provider Runtime');
  assert.equal(manifest.version, '0.10.0');
  assert.match(manifest.description, /low-latency/i);
  assert.match(manifest.description, /preview/i);
  assert.match(manifest.description, /delivery proof/i);
  assert.match(manifest.description, /Runtime Pilot Dashboard/i);
  assert.match(manifest.description, /non-preemptive batching/i);
  assert.doesNotMatch(manifest.description, /bounded final queue/i);
});

test('manifest exposes all dynamically imported sender and answer modules', async () => {
  const manifest = await readManifest();
  const resources = manifest.web_accessible_resources.flatMap(item => item.resources || []);
  assert.ok(resources.includes('content/senders/*.js'));
  assert.ok(resources.includes('content/answer-tracker.js'));
  assert.ok(resources.includes('content/preview-scheduler.js'));
  assert.ok(resources.includes('content/runtime-recovery.js'));
  assert.ok(resources.includes('content/runtime-fatal.js'));
  assert.ok(resources.includes('content/preflight-responder.js'));
  assert.ok(resources.includes('content/runtime-telemetry.js'));
  assert.ok(resources.includes('content/adapter-health.js'));
  assert.ok(resources.includes('content/role-revocation.js'));
  assert.ok(resources.includes('content/registration-recovery.js'));
  assert.ok(resources.includes('shared/*.js'));
});

test('manifest versions the low-latency evidence-driven runtime', async () => {
  const manifest = await readManifest();
  assert.equal(manifest.version, '0.10.0');
  assert.match(manifest.description, /provisional previews/i);
  assert.match(manifest.description, /provider-rendered delivery proof/i);
  assert.match(manifest.description, /Runtime Pilot Dashboard/i);
  assert.match(manifest.description, /self-healing/i);
  assert.match(manifest.description, /ephemeral session state/i);
  assert.match(manifest.description, /background-safe recovery/i);
});
test('README documents the 0.9 operational release boundaries', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Runtime 0\.10\.0/);
  assert.match(readme, /profile doctor/i);
  assert.match(readme, /lifecycle readiness/i);
  assert.match(readme, /Launch Anyway/);
  assert.match(readme, /settings\.ini/);
  assert.match(readme, /ProfileDirectory/);
  assert.doesNotMatch(readme, /not modified by the 0\.6 runtime/i);
});





test('manifest registers a browser-level exact-session export command', async () => {
  const manifest = await readManifest();
  const command = manifest.commands?.['export-active-pmia-session'];
  assert.ok(command);
  assert.equal(command.suggested_key?.default, 'Ctrl+Shift+8');
  assert.match(command.description, /export/i);
});


test('dashboard is a packaged extension surface with no external runtime dependency', async () => {
  const root = new URL('../', import.meta.url);
  const [html, css, js] = await Promise.all([
    readFile(new URL('dashboard/index.html', root), 'utf8'),
    readFile(new URL('dashboard/dashboard.css', root), 'utf8'),
    readFile(new URL('dashboard/dashboard.js', root), 'utf8')
  ]);
  assert.match(html, /Runtime Pilot/);
  assert.match(html, /dashboard\.js/);
  assert.match(css, /--aubergine/);
  assert.match(js, /pmia-dashboard:/);
  assert.doesNotMatch(`${html}${css}${js}`, /https?:\/\/|<script[^>]+src=["']https:/i);
});


test('dashboard fails pending commands immediately when its runtime port disconnects', async () => {
  const source = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
  assert.match(source, /function failPendingCommands/);
  const disconnect = source.slice(source.indexOf('port.onDisconnect.addListener'), source.indexOf('function scheduleReconnect'));
  assert.match(disconnect, /failPendingCommands\(/);
});


test('manifest grants alarms for durable recovery scheduling', async () => {
  const manifest = await readManifest();
  assert.ok(manifest.permissions.includes('alarms'));
});


test('manifest packages the hidden-tab persistence lane helper', async () => {
  const manifest = await readManifest();
  const resources = manifest.web_accessible_resources.flatMap(item => item.resources || []);
  assert.ok(resources.includes('content/persistence-lane-race.js'));
});
