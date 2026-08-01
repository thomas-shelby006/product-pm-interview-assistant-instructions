import fs from 'node:fs/promises';
import path from 'node:path';

function args(argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 2) values[String(argv[index] || '').replace(/^--/, '')] = argv[index + 1];
  return values;
}

const options = args(process.argv);
const port = Number(options.port);
const extensionPath = path.resolve(String(options['extension-path'] || ''));
const profilePath = path.resolve(String(options['profile-path'] || ''));
const evidencePath = path.resolve(String(options.evidence || 'pmia-isolated-release-evidence.json'));
const skipLiveAnswer = String(options['skip-live-answer'] || 'false') === 'true';
if (!port || !extensionPath || !profilePath) throw new Error('Missing isolated smoke arguments');

const endpoint = `http://127.0.0.1:${port}`;
const localManifest = JSON.parse(await fs.readFile(path.join(extensionPath, 'manifest.json'), 'utf8'));
const questions = Object.freeze({
  q1: 'Synthetic PMIA release Q1: Give a 30-point numbered checklist for measuring onboarding activation. Each point must be one short sentence.',
  q2: 'Synthetic PMIA release Q2: Explain activation versus engagement in exactly three bullets.',
  q3: 'Synthetic PMIA release Q3: Name two guardrail metrics for onboarding.'
});
const chatGptComposerSelector = [
  'textarea[name="prompt-textarea"]',
  '#prompt-textarea',
  'textarea[aria-label="Chat with ChatGPT"]',
  'div[contenteditable="true"][role="textbox"]'
].join(',');
const chatGptSendSelector = [
  'button[aria-label="Send prompt"]',
  'button[data-testid="send-button"]',
  'button[aria-label^="Send"]'
].join(',');

class CDP {
  constructor(url) { this.url = url; this.socket = null; this.sequence = 0; this.pending = new Map(); }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url);
      this.socket.onopen = resolve;
      this.socket.onerror = reject;
      this.socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (!message.id || !this.pending.has(message.id)) return;
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      };
    });
    return this;
  }
  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, { userGesture = false } = {}) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
    return result.result?.value ?? result.result?.description ?? null;
  }
  close() { try { this.socket?.close(); } catch {} }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}
async function targets() { return json(`${endpoint}/json/list`); }
async function waitFor(label, callback, timeoutMs = 90000, intervalMs = 250) {
  const startedAt = Date.now();
  let last = null;
  while (Date.now() - startedAt < timeoutMs) {
    last = await callback();
    if (last?.ok) return { label, elapsedMs: Date.now() - startedAt, value: last.value };
    await sleep(intervalMs);
  }
  const error = new Error(`Timed out: ${label}`);
  error.last = last;
  throw error;
}
async function targetClient(targetId) {
  const target = (await targets()).find(value => value.id === targetId);
  if (!target?.webSocketDebuggerUrl) throw new Error(`Target missing: ${targetId}`);
  return new CDP(target.webSocketDebuggerUrl).open();
}
async function extensionTargets() {
  const values = (await targets()).filter(value => ['service_worker', 'background_page'].includes(value.type) && value.url.startsWith('chrome-extension://'));
  const output = [];
  for (const target of values) {
    const client = await new CDP(target.webSocketDebuggerUrl).open();
    try {
      const raw = await client.evaluate('JSON.stringify(chrome.runtime.getManifest())');
      const manifest = JSON.parse(raw);
      output.push({ id: target.id, extensionId: new URL(target.url).hostname, name: manifest.name, version: manifest.version, url: target.url });
    } catch {}
    finally { client.close(); }
  }
  return output;
}

const version = await json(`${endpoint}/json/version`);
const browser = await new CDP(version.webSocketDebuggerUrl).open();
const createdTargets = [];
const session = `release-${Date.now()}`;
const evidence = {
  version: '1.0',
  generatedAt: new Date().toISOString(),
  isolatedProfile: { path: profilePath, temporary: true, normalProfileTouched: false },
  extensions: [],
  session: { id: session, senderTarget: '', receiverTarget: '', dashboardTarget: '' },
  selfTest: { ok: false },
  finals: [],
  batches: {},
  ledger: [],
  outbox: {},
  gap: {},
  answerCapability: { state: 'unknown' },
  transportDrill: {},
  transportDrillOk: false,
  pilotUi: {},
  pilotUiOk: false,
  failureDetails: null,
  cleanup: { processTreeClosed: false, profileRemoved: false },
  limitations: [],
  deliveryProofOk: false,
  ok: false
};

let worker = null;
let sender = null;
let receiver = null;
let dashboard = null;
let failure = null;

async function pilotState() {
  if (!worker) return null;
  const raw = await worker.evaluate(`(async()=>{const value=await chrome.storage.session.get('pmia_runtime_pilot_v1');return JSON.stringify((value.pmia_runtime_pilot_v1||[]).find(item=>item.sessionId===${JSON.stringify(session)})||null)})()`);
  return JSON.parse(raw);
}
async function pageState(client) {
  const raw = await client.evaluate(`(()=>{const composer=[...document.querySelectorAll(${JSON.stringify(chatGptComposerSelector)})].find(node=>node.offsetWidth||node.offsetHeight||node.getClientRects().length);return JSON.stringify({title:document.title,url:location.href,composer:composer?String('value' in composer?composer.value:composer.innerText||'').trim():'',users:[...document.querySelectorAll('[data-message-author-role="user"]')].map(node=>node.innerText.trim()),assistants:[...document.querySelectorAll('[data-message-author-role="assistant"]')].map(node=>node.innerText.trim()),stopAvailable:[...document.querySelectorAll('button')].some(button=>/stop generating|stop response|stop streaming/i.test([button.getAttribute('aria-label'),button.getAttribute('data-testid'),button.innerText].join(' ')))})})()`);
  return JSON.parse(raw);
}
async function manualCopy(text) {
  return sender.evaluate(`(()=>{const node=document.createElement('div');node.textContent=${JSON.stringify(text)};node.style.cssText='position:fixed;left:-9999px;top:-9999px;white-space:pre-wrap';document.body.append(node);const range=document.createRange();range.selectNodeContents(node);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('copy',{bubbles:true,cancelable:true}));selection.removeAllRanges();node.remove();return true})()`, { userGesture: true });
}

try {
  const discovered = await waitFor('candidate extension worker', async () => {
    const values = await extensionTargets();
    const candidate = values.find(value => value.name === localManifest.name && value.version === localManifest.version);
    return { ok: Boolean(candidate), value: { values, candidate } };
  }, 25000, 500);
  evidence.extensions = discovered.value.values;
  const candidate = discovered.value.candidate;
  if (!candidate) throw new Error('Exact PMIA extension identity not found');
  const workerTarget = (await targets()).find(value => value.id === candidate.id);
  worker = await new CDP(workerTarget.webSocketDebuggerUrl).open();

  const senderUrl = `https://chatgpt.com/?pmia_session=${encodeURIComponent(session)}&pmia_role=sender&pmia_provider=chatgpt`;
  const receiverUrl = `https://chatgpt.com/?pmia_session=${encodeURIComponent(session)}&pmia_role=receiver&pmia_provider=chatgpt`;
  const dashboardUrl = `chrome-extension://${candidate.extensionId}/dashboard/index.html?session=${encodeURIComponent(session)}`;
  const senderTarget = (await browser.send('Target.createTarget', { url: senderUrl, newWindow: true, background: true })).targetId;
  const receiverTarget = (await browser.send('Target.createTarget', { url: receiverUrl, newWindow: true, background: true })).targetId;
  const dashboardTarget = (await browser.send('Target.createTarget', { url: dashboardUrl, newWindow: true, background: true })).targetId;
  createdTargets.push(senderTarget, receiverTarget, dashboardTarget);
  evidence.session = { id: session, senderTarget, receiverTarget, dashboardTarget };

  await waitFor('managed lifecycle ready', async () => {
    const values = await targets();
    const selected = values.filter(value => createdTargets.includes(value.id));
    const suffix = session.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
    const senderReady = selected.some(value => value.id === senderTarget && value.title === `PMIA_SENDER_CHATGPT_${suffix}`);
    const receiverReady = selected.some(value => value.id === receiverTarget && value.title === `PMIA_RECEIVER_CHATGPT_${suffix}`);
    const dashboardReady = selected.some(value => value.id === dashboardTarget && value.url === dashboardUrl);
    return { ok: senderReady && receiverReady && dashboardReady, value: selected.map(value => ({ id: value.id, title: value.title, url: value.url })) };
  }, 60000, 500);

  sender = await targetClient(senderTarget);
  receiver = await targetClient(receiverTarget);
  dashboard = await targetClient(dashboardTarget);

  await dashboard.evaluate(`document.querySelector('[data-command="run_self_test"]')?.click(); true`, { userGesture: true });
  const selfTest = await waitFor('active no-content self-test', async () => {
    const pilot = await pilotState();
    return { ok: pilot?.selfTest?.ok === true, value: pilot?.selfTest || null };
  }, 20000, 250);
  evidence.selfTest = selfTest.value;

  const focused = await sender.evaluate(`(()=>{const editor=[...document.querySelectorAll(${JSON.stringify(chatGptComposerSelector)})].find(node=>node.offsetWidth||node.offsetHeight||node.getClientRects().length);if(!editor)return false;editor.focus();return true})()`, { userGesture: true });
  if (!focused) throw new Error('Synthetic Q1 composer was unavailable');
  await sender.send('Input.insertText', { text: questions.q1 });
  await waitFor('Q1 send control ready', async () => {
    const raw = await sender.evaluate(`(()=>{const composer=[...document.querySelectorAll(${JSON.stringify(chatGptComposerSelector)})].find(node=>node.offsetWidth||node.offsetHeight||node.getClientRects().length);const button=[...document.querySelectorAll(${JSON.stringify(chatGptSendSelector)})].find(node=>node.offsetWidth||node.offsetHeight||node.getClientRects().length);return JSON.stringify({composer:composer?String('value' in composer?composer.value:composer.innerText||'').trim():'',sendReady:Boolean(button&&!button.disabled)})})()`);
    const value = JSON.parse(raw);
    return { ok: value.composer === questions.q1 && value.sendReady, value };
  }, 20000, 200);
  const submitted = await sender.evaluate(`(()=>{const button=[...document.querySelectorAll(${JSON.stringify(chatGptSendSelector)})].find(node=>node.offsetWidth||node.offsetHeight||node.getClientRects().length);if(!button||button.disabled)return false;button.click();return true})()`, { userGesture: true });
  if (!submitted) throw new Error('Synthetic Q1 send control disappeared before click');

  await waitFor('Q1 rendered in receiver', async () => {
    const state = await pageState(receiver);
    return { ok: state.users.includes(questions.q1), value: state };
  }, 90000, 500);

  await manualCopy(questions.q2);
  await sleep(350);
  await manualCopy(questions.q3);

  const proof = await waitFor('three exact rendered proofs', async () => {
    const pilot = await pilotState();
    const selected = (pilot?.ledger || []).filter(item => Object.values(questions).includes(item?.envelope?.text));
    const deliveryProofOk = selected.length === 3 && selected.every(item => item.state === 'proven');
    return { ok: deliveryProofOk, value: { pilot, selected, deliveryProofOk } };
  }, 120000, 500);

  const pilot = proof.value.pilot;
  const receiverState = await pageState(receiver);
  evidence.finals = Object.entries(questions).map(([key, text]) => ({ key, text, proven: proof.value.selected.some(item => item.envelope?.text === text && item.state === 'proven') }));
  evidence.batches = { active: pilot?.batchState?.active || null, next: pilot?.batchState?.next || null, lastCompleted: pilot?.batchState?.lastCompleted || null, receiverUsers: receiverState.users };
  evidence.ledger = proof.value.selected.map(item => ({ id: item.id, seq: item.envelope?.seq || 0, state: item.state, batchId: item.batchId || '', text: item.envelope?.text || '' }));
  evidence.outbox = { count: Number(pilot?.senderOutboxState?.count || 0), state: pilot?.senderOutboxState?.state || 'clear', restoredCount: Number(pilot?.senderOutboxState?.restoredCount || 0) };
  const gapEvent = [...(pilot?.timeline || [])].reverse().find(event => ['sequence_gap', 'sequence_gap_cleared'].includes(event?.type));
  evidence.gap = { clear: !gapEvent || gapEvent.type === 'sequence_gap_cleared', lastEvent: gapEvent?.type || 'none', data: gapEvent?.data || {} };
  if (!skipLiveAnswer && receiverState.assistants.some(text => text.trim())) {
    evidence.answerCapability = { state: 'available', assistantCount: receiverState.assistants.length };
  } else {
    evidence.answerCapability = { state: 'anonymous_answer_unavailable', assistantCount: receiverState.assistants.length };
    evidence.limitations.push('The isolated anonymous provider session did not expose answer text; rendered delivery proof remained fully verifiable.');
  }
  await dashboard.evaluate(`document.querySelector('[data-view="review"]')?.click(); true`, { userGesture: true });
  await dashboard.evaluate(`document.querySelector('[data-command="run_transport_drill"]')?.click(); true`, { userGesture: true });
  const drill = await waitFor('no-content transport drill', async () => {
    const current = await pilotState();
    const report = current?.lastTransportDrill || null;
    return { ok: Boolean(report && Array.isArray(report.checks) && report.checks.length === 12), value: report };
  }, 30000, 250);
  evidence.transportDrill = drill.value;
  evidence.transportDrillOk = drill.value?.ok === true
    && drill.value?.contentAccessed === false
    && drill.value.checks.every(check => check.ok === true);

  async function dashboardUiState(width, height, label) {
    await dashboard.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await sleep(180);
    const raw = await dashboard.evaluate(`(()=>{
      const required=['forecastRisk','forecastDrain','forecastP95','forecastThroughput','recoveryBudgetState','runTransportDrill','transportDrillReport','traceSearch','traceResults','traceDetail','exportSupportBundle','supportBundleStatus'];
      const mechanics=document.querySelector('.mechanics-grid');
      const traces=document.querySelector('.trace-layout');
      const panel=document.querySelector('[data-view-panel="review"]');
      return JSON.stringify({
        viewport:{width:innerWidth,height:innerHeight},
        scrollWidth:document.documentElement.scrollWidth,
        horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
        required:Object.fromEntries(required.map(id=>[id,Boolean(document.getElementById(id))])),
        reviewActive:Boolean(panel?.classList.contains('active')),
        mechanicsColumns:mechanics?getComputedStyle(mechanics).gridTemplateColumns:'',
        traceColumns:traces?getComputedStyle(traces).gridTemplateColumns:'',
        traceResultCount:document.querySelectorAll('[data-trace-id]').length,
        drillReportReady:(document.getElementById('transportDrillReport')?.textContent||'').includes('handshake'),
        forecastRisk:(document.getElementById('forecastRisk')?.textContent||'').trim(),
        recoveryBudgetState:(document.getElementById('recoveryBudgetState')?.textContent||'').trim(),
        accessibility:{polite:Boolean(document.querySelector('[aria-live="polite"]')),assertive:Boolean(document.querySelector('[aria-live="assertive"]')),shortcutDialog:Boolean(document.getElementById('shortcutHelpDialog'))},
        liveIntegrity:Boolean(document.getElementById('liveUxBudgetState')),
        crashResume:Boolean(document.getElementById('crashResumeCard'))
      });
    })()`);
    const value = JSON.parse(raw);
    const screenshot = await dashboard.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const screenshotPath = path.join(path.dirname(evidencePath), `pilot-${label}.png`);
    await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    return { ...value, screenshotPath };
  }

  const desktopUi = await dashboardUiState(1200, 900, 'desktop');
  const mobileUi = await dashboardUiState(320, 900, '320px');
  const tinyUi = await dashboardUiState(280, 900, '280px');
  await dashboard.send('Emulation.setEmulatedMedia', { media: 'print' });
  const printUi = await dashboardUiState(1200, 900, 'print');
  await dashboard.send('Emulation.setEmulatedMedia', { media: 'screen' });
  await dashboard.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  evidence.pilotUi = { desktop: desktopUi, mobile: mobileUi, tiny: tinyUi, print: printUi };
  evidence.pilotUiOk = [desktopUi, mobileUi, tinyUi, printUi].every(value => (
    !value.horizontalOverflow
    && value.reviewActive
    && Object.values(value.required).every(Boolean)
    && value.drillReportReady
    && value.traceResultCount >= 3
    && value.accessibility.polite
    && value.accessibility.assertive
    && value.accessibility.shortcutDialog
  ));

  evidence.deliveryProofOk = proof.value.deliveryProofOk && evidence.outbox.count === 0 && evidence.gap.clear;
  evidence.ok = evidence.deliveryProofOk && evidence.transportDrillOk && evidence.pilotUiOk;
} catch (error) {
  failure = error;
  evidence.error = String(error?.stack || error);
  evidence.limitations.push(`Smoke failure: ${String(error?.message || error)}`);
  let sendControls = [];
  try {
    if (sender) {
      const raw = await sender.evaluate(`(()=>JSON.stringify([...document.querySelectorAll('button')].map(button=>({
        ariaLabel:String(button.getAttribute('aria-label')||''),
        testId:String(button.getAttribute('data-testid')||''),
        text:String(button.innerText||'').trim().slice(0,80),
        disabled:Boolean(button.disabled),
        visible:Boolean(button.offsetWidth||button.offsetHeight||button.getClientRects().length)
      })).filter(value=>/send/i.test([value.ariaLabel,value.testId,value.text].join(' '))).slice(0,12)))()`);
      sendControls = JSON.parse(raw);
    }
  } catch {}
  evidence.failureDetails = {
    message: String(error?.message || error),
    lastSample: error?.last?.value || error?.last || null,
    sendControls
  };
  try {
    const pilot = await pilotState();
    evidence.ledger = pilot?.ledger || [];
    evidence.outbox = pilot?.senderOutboxState || {};
    evidence.batches = pilot?.batchState || {};
  } catch {}
} finally {
  for (const client of [sender, receiver, dashboard, worker]) client?.close();
  for (const targetId of createdTargets) {
    try { await browser.send('Target.closeTarget', { targetId }); } catch {}
  }
  browser.close();
  evidence.completedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({ ok: evidence.ok, evidencePath, deliveryProofOk: evidence.deliveryProofOk, transportDrillOk: evidence.transportDrillOk, pilotUiOk: evidence.pilotUiOk, selfTest: evidence.selfTest?.ok === true, outbox: evidence.outbox, gap: evidence.gap, answerCapability: evidence.answerCapability, limitations: evidence.limitations }, null, 2));
if (failure || !evidence.ok) process.exit(1);