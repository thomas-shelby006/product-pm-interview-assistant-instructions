import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionDir = resolve(runtimeDir, 'extension');
const edge = process.env.PMIA_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9400 + Math.floor(Math.random() * 400);
const profile = await mkdtemp(join(tmpdir(), 'pmia-012-smoke-'));
let child = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = path => `http://127.0.0.1:${port}${path}`;

async function waitForJson(path, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() <= deadline) {
    try {
      const response = await fetch(endpoint(path));
      if (response.ok) return await response.json();
    } catch (error) { lastError = error; }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${path}: ${lastError?.message || 'unavailable'}`);
}
async function waitForTarget(predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const targets = await waitForJson('/json/list', 2000);
    const target = targets.find(predicate);
    if (target) return target;
    await sleep(100);
  }
  throw new Error('Timed out waiting for DevTools target');
}

async function openTarget(url) {
  const response = await fetch(endpoint(`/json/new?${encodeURIComponent(url)}`), { method:'PUT' });
  if (!response.ok) throw new Error(`Could not open ${url}: HTTP ${response.status}`);
  return response.json();
}

async function cdp(target, method, params = {}) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once:true });
    socket.addEventListener('error', rejectOpen, { once:true });
  });
  const id = 1;
  const result = await new Promise((resolveCall, rejectCall) => {
    const timer = setTimeout(() => rejectCall(new Error(`CDP timeout: ${method}`)), 5000);
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      clearTimeout(timer);
      if (message.error) rejectCall(new Error(message.error.message));
      else resolveCall(message.result);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.close();
  return result;
}
async function evalValue(target, expression) {
  const result = await cdp(target, 'Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result?.value;
}

const args = [
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`,
  `--disable-extensions-except=${extensionDir}`,
  `--load-extension=${extensionDir}`,
  '--no-first-run', '--no-default-browser-check',
  '--window-position=-32000,-32000', '--window-size=1100,760',
  'about:blank'
];

try {
  child = spawn(edge, args, { stdio:'ignore', windowsHide:true });
  await waitForJson('/json/version', 20000);
  const worker = await waitForTarget(target => target.type === 'service_worker' && target.url.includes('/simple/service-worker.js'), 20000);
  const extensionId = new URL(worker.url).host;
  const studio = await openTarget(`chrome-extension://${extensionId}/studio/index.html`);
  const cockpit = await openTarget(`chrome-extension://${extensionId}/cockpit/index.html?session=smoke`);
  await sleep(250);
  const version = await evalValue(studio, 'chrome.runtime.getManifest().version');
  if (version !== '0.12.0') throw new Error(`Unexpected extension version ${version}`);
  const studioState = await evalValue(studio, `(() => ({
    title:document.title,
    launch:Boolean(document.getElementById('launch')),
    providerSelects:['senderProvider','receiverProvider','comparisonProvider'].every(id => Boolean(document.getElementById(id))),
    resume:Boolean(document.getElementById('resume')),
    jd:Boolean(document.getElementById('jobDescription')),
    runtimeError:document.documentElement.dataset.pmiaSimpleError || ''
  }))()`);
  const cockpitState = await evalValue(cockpit, `(() => ({
    title:document.title,
    controls:['autoForward','pause','sendGathered','export','help'].every(id => Boolean(document.getElementById(id))),
    windows:['sender','receiver','comparison'].every(role => Boolean(document.querySelector('[data-role="' + role + '"]'))),
    dockHeight:Math.round(document.querySelector('.dock')?.getBoundingClientRect().height || 0),
    connection:document.getElementById('connection')?.textContent || ''
  }))()`);

  if (!studioState.launch || !studioState.providerSelects || !studioState.resume || !studioState.jd) {
    throw new Error(`Studio surface incomplete: ${JSON.stringify(studioState)}`);
  }
  if (!cockpitState.controls || !cockpitState.windows || cockpitState.dockHeight !== 120) {
    throw new Error(`Cockpit surface incomplete: ${JSON.stringify(cockpitState)}`);
  }

  const transportTarget = await openTarget(`chrome-extension://${extensionId}/testing/simple-transport-smoke.html`);
  const transportDeadline = Date.now() + 5000;
  let transport = null;
  while (Date.now() <= transportDeadline) {
    transport = await evalValue(transportTarget, 'window.__PMIA_SIMPLE_TRANSPORT_RESULT__ || null');
    if (transport) break;
    await sleep(50);
  }
  if (!transport?.ok) throw new Error(`Transport smoke failed: ${JSON.stringify(transport)}`);

  console.log(JSON.stringify({
    ok:true, version, extensionId,
    serviceWorker:'simple/service-worker.js',
    studio:studioState,
    cockpit:cockpitState,
    transport
  }, null, 2));
} finally {
  if (child?.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio:'ignore' });
  await sleep(300);
  await rm(profile, { recursive:true, force:true, maxRetries:5, retryDelay:150 }).catch(() => {});
}
