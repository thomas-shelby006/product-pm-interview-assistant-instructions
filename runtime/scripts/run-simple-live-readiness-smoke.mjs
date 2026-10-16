// Read-only acceptance probe for current public provider UI. Never sends messages or touches existing profiles.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionDir = resolve(process.env.PMIA_EXTENSION_DIR || resolve(runtimeDir, 'extension'));
const edge = process.env.PMIA_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 12000 + Math.floor(Math.random() * 5000);
const profile = await mkdtemp(join(tmpdir(), 'pmia-live-readiness-'));
let child = null;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = path => `http://127.0.0.1:${port}${path}`;
async function get(path) {
  const response = await fetch(endpoint(path));
  if (!response.ok) throw new Error(`HTTP ${response.status} at ${path}`);
  return response.json();
}
async function waitForBrowser() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try { return await get('/json/version'); } catch {}
    await sleep(150);
  }
  throw new Error('Edge remote debugging endpoint not ready');
}
async function openTarget(url) {
  const response = await fetch(endpoint('/json/new?' + encodeURIComponent(url)), { method:'PUT' });
  if (!response.ok) throw new Error('Cannot create target');
  return response.json();
}
async function inspect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once:true });
    socket.addEventListener('error', rejectOpen, { once:true });
  });
  const value = await new Promise((resolveValue, rejectValue) => {
    const timer = setTimeout(() => rejectValue(new Error('CDP inspect timeout')), 6000);
    socket.addEventListener('message', event => {
      const response = JSON.parse(event.data);
      if (response.id !== 1) return;
      clearTimeout(timer);
      if (response.error) rejectValue(new Error(response.error.message));
      else resolveValue(response.result?.result?.value || null);
    });
    socket.send(JSON.stringify({ id:1, method:'Runtime.evaluate',
      params:{ returnByValue:true, expression:`(() => ({
        origin:location.origin,
        pathname:location.pathname,
        title:document.title.slice(0,100),
        pmiaRole:document.documentElement.dataset.pmiaSimpleRole || '',
        pmiaError:document.documentElement.dataset.pmiaSimpleError || '',
        loginPrompt:Boolean(document.querySelector('a[href*="login"],button[data-testid*="login"],a[href*="sign-in"]')),
        composer:Boolean(document.querySelector('#prompt-textarea, textarea[name="prompt-textarea"], .ProseMirror, [contenteditable="true"][data-testid="chat-input"]')),
        readyState:document.readyState
      }))()` }
    }));
  }).finally(() => socket.close());
  return value;
}
try {
  child = spawn(edge, [
    `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
    `--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`,
    '--no-first-run', '--no-default-browser-check',
    '--window-position=-32000,-32000', '--window-size=1000,700','about:blank'
  ], { stdio:'ignore', windowsHide:true });
  await waitForBrowser();
  const session = 'pmia_readiness_' + Date.now();
  const configs = [
    { provider:'chatgpt', url:`https://chatgpt.com/?pmia_session=${session}&pmia_role=sender&pmia_provider=chatgpt` },
    { provider:'claude', url:`https://claude.ai/new?pmia_session=${session}&pmia_role=receiver&pmia_provider=claude` }
  ];
  const targets = await Promise.all(configs.map(item => openTarget(item.url)));
  const deadline = Date.now() + 20000;
  let results = [];
  while (Date.now() < deadline) {
    results = await Promise.all(targets.map(async (target, i) => ({
      provider:configs[i].provider, ...(await inspect(target).catch(error => ({ inspectionError:String(error.message || error) })))
    })));
    if (results.every(value => value.pmiaRole || value.pmiaError)) break;
    await sleep(550);
  }
  console.log(JSON.stringify({ ok:true, isolated:true, authenticated:false, results }, null, 2));
} finally {
  if (child?.pid) spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{ stdio:'ignore' });
  await sleep(300);
  await rm(profile, { recursive:true, force:true, maxRetries:5, retryDelay:150 }).catch(() => {});
}
