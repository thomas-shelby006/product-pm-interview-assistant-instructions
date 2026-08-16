import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionDir = resolve(runtimeDir, 'extension');
const edge = process.env.PMIA_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9800 + Math.floor(Math.random() * 150);
const profile = await mkdtemp(join(tmpdir(), 'pmia-012-provider-smoke-'));
const sessionId = `fixture_${Date.now().toString(36)}`;
const token = `PMIA_FIXTURE_${Date.now()}`;
let child = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = path => `http://127.0.0.1:${port}${path}`;

async function waitForJson(path, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    try { const r = await fetch(endpoint(path)); if (r.ok) return r.json(); } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${path}`);
}
async function waitForTarget(predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const targets = await waitForJson('/json/list', 2000);
    const target = targets.find(predicate);
    if (target) return target;
    await sleep(100);
  }
  throw new Error('Timed out waiting for target');
}

async function openTarget(url) {
  const response = await fetch(endpoint(`/json/new?${encodeURIComponent(url)}`), { method:'PUT' });
  if (!response.ok) throw new Error(`Could not open target ${url}`);
  return response.json();
}

async function cdp(target, method, params = {}) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once:true });
    socket.addEventListener('error', rejectOpen, { once:true });
  });
  const id = 1;
  const value = await new Promise((resolveCall, rejectCall) => {
    const timer = setTimeout(() => rejectCall(new Error(`CDP timeout ${method}`)), 5000);
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
  return value;
}

async function evaluate(target, expression) {
  const response = await cdp(target, 'Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'evaluation failed');
  return response.result?.value;
}

async function openFixtureTarget(url, html) {
  const target = await openTarget('about:blank');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once:true });
    socket.addEventListener('error', rejectOpen, { once:true });
  });
  let sequence = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolveCall, rejectCall) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); rejectCall(new Error(`CDP timeout ${method}`)); }, 5000);
    pending.set(id, { resolveCall, rejectCall, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timer);
      if (message.error) item.rejectCall(new Error(message.error.message)); else item.resolveCall(message.result);
      return;
    }
    if (message.method === 'Fetch.requestPaused' && message.params?.resourceType === 'Document') {
      void send('Fetch.fulfillRequest', {
        requestId:message.params.requestId, responseCode:200,
        responseHeaders:[{ name:'Content-Type', value:'text/html; charset=utf-8' }],
        body:Buffer.from(html).toString('base64')
      });
    }
  });
  await send('Fetch.enable', { patterns:[{ urlPattern:'*', resourceType:'Document', requestStage:'Request' }] });
  await send('Page.navigate', { url });
  await sleep(150);
  socket.close();
  return target;
}
function managedUrl(base, role, provider) {
  const url = new URL(base);
  url.searchParams.set('pmia_session', sessionId);
  url.searchParams.set('pmia_role', role);
  url.searchParams.set('pmia_provider', provider);
  return url.href;
}

async function waitForRuntime(target, role, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const value = await evaluate(target, `({
      role:document.documentElement.dataset.pmiaSimpleRole || '',
      error:document.documentElement.dataset.pmiaSimpleError || '',
      title:document.title
    })`).catch(() => null);
    if (value?.role === role) return value;
    if (value?.error) throw new Error(`${role} runtime failed: ${value.error}`);
    await sleep(50);
  }
  const diagnostic = await evaluate(target, `({
    href:location.href,
    title:document.title,
    role:document.documentElement.dataset.pmiaSimpleRole || '',
    error:document.documentElement.dataset.pmiaSimpleError || '',
    bootstrap:document.documentElement.dataset.pmiaSimpleBootstrap || '',
    chatComposer:Boolean(document.getElementById('prompt-textarea')),
    claudeComposer:Boolean(document.querySelector('.ProseMirror')),
    chatWriter:Boolean(window.__PMIA_SIMPLE_CHATGPT_WRITER__),
    claudeWriter:Boolean(window.__PMIA_SIMPLE_CLAUDE_WRITER__)
  })`).catch(() => null);
  throw new Error(`${role} runtime did not become ready: ${JSON.stringify(diagnostic)}`);
}

const chatFixture = `(() => {
  document.body.innerHTML = '<main id="feed"></main><div id="prompt-textarea" contenteditable="true" role="textbox"></div><button aria-label="Send prompt">Send</button>';
  const composer = document.getElementById('prompt-textarea');
  const send = document.querySelector('button[aria-label="Send prompt"]');
  send.addEventListener('click', () => {
    const text = String(composer.innerText || composer.textContent || '').trim();
    if (!text) return;
    const section = document.createElement('section');
    section.dataset.turn = 'user';
    section.dataset.turnId = 'fixture-' + Math.random().toString(36).slice(2);
    section.textContent = 'You said: ' + text;
    section.dataset.fixtureRenderedAt = String(Date.now());
    document.getElementById('feed').appendChild(section);
    composer.textContent = '';
    window.__pmiaFixtureRenderedAt = Number(section.dataset.fixtureRenderedAt);
  });
  true;
})()`;

const claudeFixture = `(() => {
  document.body.innerHTML = '<main id="feed"></main><div class="tiptap ProseMirror" data-testid="chat-input" contenteditable="true"></div><button aria-label="Send message">Send</button>';
  const composer = document.querySelector('.ProseMirror');
  composer.editor = {
    commands:{ setContent(value){
      const text = value?.content?.[0]?.content?.[0]?.text || '';
      composer.textContent = text;
      return true;
    }},
    getText(){ return composer.textContent || ''; }
  };
  document.querySelector('button[aria-label="Send message"]').addEventListener('click', () => {
    const text = String(composer.textContent || '').trim();
    if (!text) return;
    const node = document.createElement('div');
    node.dataset.testid = 'user-message';
    node.textContent = text;
    node.dataset.fixtureRenderedAt = String(Date.now());
    document.getElementById('feed').appendChild(node);
    composer.textContent = '';
    window.__pmiaFixtureRenderedAt = Number(node.dataset.fixtureRenderedAt);
  });
  true;
})()`;

const fixtureHtml = script => `<!doctype html><html><head><meta charset="utf-8"><title>PMIA Fixture</title></head><body><script>${script}<\/script></body></html>`;

async function waitForRendered(target, expected, selector, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const value = await evaluate(target, `(() => {
      const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const match = nodes.find(node => String(node.innerText || node.textContent || '').replace(/^\\s*You said:\\s*/i,'').trim() === ${JSON.stringify(expected)});
      return {
        found:Boolean(match),
        renderedAt:Number(match?.dataset?.fixtureRenderedAt || window.__pmiaFixtureRenderedAt || 0)
      };
    })()`);
    if (value?.found) return value;
    await sleep(20);
  }
  return { found:false, renderedAt:0 };
}

const args = [
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`,
  `--disable-extensions-except=${extensionDir}`,
  `--load-extension=${extensionDir}`,
  '--no-first-run', '--no-default-browser-check',
  '--window-position=-32000,-32000', '--window-size=1000,700',
  'about:blank'
];

try {
  child = spawn(edge, args, { stdio:'ignore', windowsHide:true });
  await waitForJson('/json/version', 20000);
  await waitForTarget(target => target.type === 'service_worker' && target.url.includes('/simple/service-worker.js'), 20000);

  const [sender, receiver, comparison] = await Promise.all([
    openFixtureTarget(managedUrl('https://chatgpt.com/', 'sender', 'chatgpt'), fixtureHtml(chatFixture)),
    openFixtureTarget(managedUrl('https://claude.ai/new', 'receiver', 'claude'), fixtureHtml(claudeFixture)),
    openFixtureTarget(managedUrl('https://chatgpt.com/', 'comparison', 'chatgpt'), fixtureHtml(chatFixture))
  ]);

  await Promise.all([
    waitForRuntime(sender, 'sender'),
    waitForRuntime(receiver, 'receiver'),
    waitForRuntime(comparison, 'comparison')
  ]);
  await sleep(150);
  const submittedAt = Date.now();
  await evaluate(sender, `(() => {
    const section = document.createElement('section');
    section.dataset.turn = 'user';
    section.dataset.turnId = 'sender-fixture-turn';
    section.textContent = 'You said: ' + ${JSON.stringify(token)};
    document.getElementById('feed').appendChild(section);
    window.__pmiaFixtureSubmittedAt = Date.now();
    return true;
  })()`);

  const [receiverProof, comparisonProof] = await Promise.all([
    waitForRendered(receiver, token, '[data-testid="user-message"]'),
    waitForRendered(comparison, token, 'section[data-turn="user"][data-turn-id]')
  ]);
  const receiverMs = receiverProof.renderedAt ? receiverProof.renderedAt - submittedAt : null;
  const comparisonMs = comparisonProof.renderedAt ? comparisonProof.renderedAt - submittedAt : null;
  const skewMs = receiverProof.renderedAt && comparisonProof.renderedAt
    ? Math.abs(receiverProof.renderedAt - comparisonProof.renderedAt)
    : null;

  const result = {
    ok:Boolean(receiverProof.found && comparisonProof.found),
    token,
    receiver:{ rendered:receiverProof.found, elapsedMs:receiverMs },
    comparison:{ rendered:comparisonProof.found, elapsedMs:comparisonMs },
    renderSkewMs:skewMs
  };
  if (!result.ok) {
    result.comparisonDiagnostics = await evaluate(comparison, `(() => {
      const composer = document.getElementById('prompt-textarea');
      const send = document.querySelector('button[aria-label="Send prompt"]');
      return {
        role:document.documentElement.dataset.pmiaSimpleRole || '',
        error:document.documentElement.dataset.pmiaSimpleError || '',
        mainWriter:Boolean(window.__PMIA_SIMPLE_CHATGPT_WRITER__),
        composerText:String(composer?.innerText || composer?.textContent || '').trim(),
        sendDisabled:Boolean(send?.disabled),
        userTurns:document.querySelectorAll('section[data-turn="user"][data-turn-id]').length,
        renderedAt:Number(window.__pmiaFixtureRenderedAt || 0)
      };
    })()`);
    throw new Error(`Provider fixture delivery failed: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (child?.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio:'ignore' });
  await sleep(300);
  await rm(profile, { recursive:true, force:true, maxRetries:5, retryDelay:150 }).catch(() => {});
}
