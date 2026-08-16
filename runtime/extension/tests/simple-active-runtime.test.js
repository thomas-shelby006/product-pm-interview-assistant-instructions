import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', root), 'utf8'));
const worker = fs.readFileSync(new URL('simple/service-worker.js', root), 'utf8');
const browserEntry = fs.readFileSync(new URL('simple/browser-entry.js', root), 'utf8');
const contentMain = fs.readFileSync(new URL('simple/content-main.js', root), 'utf8');

test('PMIA 0.12 activates only the simple runtime entry points', () => {
  assert.equal(manifest.version, '0.12.0');
  assert.equal(manifest.background.service_worker, 'simple/service-worker.js');
  const scripts = manifest.content_scripts.flatMap(value => value.js || []);
  assert.ok(scripts.includes('simple/content-main.js'));
  assert.ok(scripts.includes('simple/claude-main.js'));
  assert.ok(scripts.includes('simple/chatgpt-main.js'));
  assert.ok(!scripts.includes('content/main.js'));
  assert.ok(!scripts.includes('content/signals/claude-main.js'));
  assert.equal(manifest.action?.default_title, 'Open PMIA Studio');
  assert.equal(manifest.action?.default_popup, undefined);
  assert.match(worker, /chrome\.action\.onClicked\.addListener/);
  assert.match(worker, /studio\/index\.html/);
});

test('managed role config is captured before ChatGPT can redirect the project URL', () => {
  const loader = manifest.content_scripts.find(value => (value.js || []).includes('simple/content-main.js'));
  assert.equal(loader?.run_at, 'document_start');
  assert.match(contentMain, /pmia_simple_config_v1/);
  assert.match(contentMain, /sessionStorage\.setItem/);
  assert.ok(contentMain.indexOf('sessionStorage.setItem') < contentMain.indexOf('import('));
});

test('active service worker has no legacy Pilot batch sequence or recovery hot-path dependency', () => {
  assert.doesNotMatch(worker, /pilot|batch|sequence|sender-outbox|runtime-recovery|delivery-coordinator/i);
});

test('manifest exposes only simple dynamic modules required by provider content runtime', () => {
  const resources = manifest.web_accessible_resources.flatMap(value => value.resources || []);
  assert.ok(resources.includes('simple/*.js'));
  assert.ok(resources.includes('simple/adapters/*.js'));
  assert.ok(!resources.includes('content/entry.js'));
});

test('browser entry uses persistent MAIN-world write bridges for both answer providers', () => {
  assert.match(browserEntry, /createClaudeWriteBridge/);
  assert.match(browserEntry, /createChatGptWriteBridge/);
  assert.match(browserEntry, /waitForProviderReady/);
  assert.match(browserEntry, /createSimpleChatGptAdapter\(\{\s*doc,\s*writeInMain/);
});
