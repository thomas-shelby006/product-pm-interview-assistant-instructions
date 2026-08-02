import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
const sourceCommit = String(options.commit || options['source-commit'] || '').trim();
if (!port || !extensionPath || !profilePath) throw new Error('Missing isolated smoke arguments');

const endpoint = `http://127.0.0.1:${port}`;
const localManifest = JSON.parse(await fs.readFile(path.join(extensionPath, 'manifest.json'), 'utf8'));
const reachabilityModule = await import(pathToFileURL(path.join(extensionPath, 'shared/command-reachability-audit.js')).href);
const registryModule = await import(pathToFileURL(path.join(extensionPath, 'shared/operator-command-registry.js')).href);
const [dashboardMarkup, dashboardSource, controllerSource] = await Promise.all([
  fs.readFile(path.join(extensionPath, 'dashboard/index.html'), 'utf8'),
  fs.readFile(path.join(extensionPath, 'dashboard/dashboard.js'), 'utf8'),
  fs.readFile(path.join(extensionPath, 'shared/runtime-pilot-controller.js'), 'utf8')
]);
const commandReachability = reachabilityModule.auditCommandReachability({ html:dashboardMarkup, dashboardSource, controllerSource });
const commandRegistryDigest = registryModule.commandRegistryDigestSource();
if (!commandReachability.ok) throw new Error(`Command reachability failed: ${JSON.stringify(commandReachability.errors)}`);
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
  async open(timeoutMs = 5000) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { try { this.socket?.close(); } catch {} reject(new Error('CDP open timed out')); }, timeoutMs);
      this.socket = new WebSocket(this.url);
      this.socket.onopen = () => { clearTimeout(timer); resolve(); };
      this.socket.onerror = error => { clearTimeout(timer); reject(error); };
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
  send(method, params = {}, timeoutMs = 10000) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP ${method} timed out`)); }, timeoutMs);
      this.pending.set(id, { resolve:value => { clearTimeout(timer); resolve(value); }, reject:error => { clearTimeout(timer); reject(error); } });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, { userGesture = false } = {}) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
    return result.result?.value ?? result.result?.description ?? null;
  }
  close() { for (const pending of this.pending.values()) pending.reject(new Error('CDP connection closed')); this.pending.clear(); try { this.socket?.close(); } catch {} }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
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
  const values = (await targets()).filter(value => value.type === 'service_worker' && value.url.startsWith('chrome-extension://'));
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
  sourceCommit,
  commit: sourceCommit,
  generatedAt: new Date().toISOString(),
  isolatedProfile: { path: profilePath, temporary: true, normalProfileTouched: false },
  extensions: [],
  session: { id: session, senderTarget: '', receiverTarget: '', dashboardTarget: '' },
  commandReachability,
  commandRegistryDigest,
  selfTest: { ok: false },
  sourceSubmission: { attempts: 0, rendered: false },
  finals: [],
  batches: {},
  ledger: [],
  outbox: {},
  gap: {},
  answerCapability: { state: 'unknown' },
  transportDrill: {},
  transportDrillControl: {},
  transportDrillOk: false,
  pilotUi: {},
  pilotUiOk: false,
  productionUi: {},
  productionUiOk: false,
  assistUi: {},
  assistUiOk: false,
  reliabilityUiOk: false,
  operationsUi: {},
  operationsUiOk: false,
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
  const raw = await worker.evaluate(`(async()=>{const value=await chrome.storage.session.get('pmia_runtime_pilot_v1');const stored=value.pmia_runtime_pilot_v1;const sessions=Array.isArray(stored)?stored:(Array.isArray(stored?.sessions)?stored.sessions:[]);return JSON.stringify(sessions.find(item=>item.sessionId===${JSON.stringify(session)})||null)})()`);
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

  async function submitSyntheticQ1Attempt(attempt) {
    const before = await pageState(sender);
    if (before.users.includes(questions.q1)) return { ok: true, attempt, alreadyRendered: true };
    const composer = await sender.evaluate(`(()=>{const editor=[...document.querySelectorAll(${JSON.stringify(chatGptComposerSelector)})].find(node=>node.offsetWidth||node.offsetHeight||node.getClientRects().length);if(!editor)return JSON.stringify({ok:false});editor.focus();const value=String('value' in editor?editor.value:editor.innerText||'').trim();return JSON.stringify({ok:true,value})})()`, { userGesture: true });
    const composerState = JSON.parse(composer);
    if (!composerState.ok) return { ok: false, attempt, error: 'composer_unavailable' };
    if (composerState.value !== questions.q1) {
      if (composerState.value) {
        await sender.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2 });
        await sender.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 });
        await sender.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace' });
        await sender.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace' });
      }
      await sender.send('Input.insertText', { text: questions.q1 });
    }
    await waitFor(`Q1 send control ready (attempt ${attempt})`, async () => {
      const raw = await sender.evaluate(`(()=>{const composer=[...document.querySelectorAll(${JSON.stringify(chatGptComposerSelector)})].find(node=>node.offsetWidth||node.offsetHeight||node.getClientRects().length);const button=[...document.querySelectorAll(${JSON.stringify(chatGptSendSelector)})].find(node=>node.offsetWidth||node.offsetHeight||node.getClientRects().length);return JSON.stringify({composer:composer?String('value' in composer?composer.value:composer.innerText||'').trim():'',sendReady:Boolean(button&&!button.disabled)})})()`);
      const value = JSON.parse(raw);
      return { ok: value.composer === questions.q1 && value.sendReady, value };
    }, 20000, 200);
    const submitted = await sender.evaluate(`(()=>{const button=[...document.querySelectorAll(${JSON.stringify(chatGptSendSelector)})].find(node=>node.offsetWidth||node.offsetHeight||node.getClientRects().length);if(!button||button.disabled)return false;button.click();return true})()`, { userGesture: true });
    if (!submitted) return { ok: false, attempt, error: 'send_control_disappeared' };
    try {
      const rendered = await waitFor(`Q1 rendered in sender (attempt ${attempt})`, async () => {
        const value = await pageState(sender);
        return { ok: value.users.includes(questions.q1), value };
      }, 12000, 250);
      return { ok: true, attempt, rendered: rendered.value };
    } catch (error) {
      return { ok: false, attempt, error: error.message, last: error.last || null };
    }
  }

  let sourceSubmission = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    sourceSubmission = await submitSyntheticQ1Attempt(attempt);
    evidence.sourceSubmission = { attempts: attempt, rendered: sourceSubmission.ok, error: sourceSubmission.error || '', lateGraceUsed: false };
    if (sourceSubmission.ok) break;
    if (attempt === 1) {
      try {
        const late = await waitFor('Q1 late render before retry', async () => {
          const value = await pageState(sender);
          return { ok: value.users.includes(questions.q1), value };
        }, 20000, 250);
        sourceSubmission = { ok: true, attempt, rendered: late.value, lateGrace: true };
        evidence.sourceSubmission = { attempts: attempt, rendered: true, error: '', lateGraceUsed: true };
        break;
      } catch {}
    }
  }
  if (!sourceSubmission?.ok) throw new Error(`Synthetic Q1 did not render in sender after ${evidence.sourceSubmission.attempts} attempt(s)`);

  await waitFor('Q1 rendered in receiver', async () => {
    const state = await pageState(receiver);
    return { ok: state.users.includes(questions.q1), value: state };
  }, 90000, 500);

  await manualCopy(questions.q2);
  await sleep(350);
  await manualCopy(questions.q3);

  evidence.noResponseResolution = { required: false, action: '', completedAt: 0 };
  const resolutionDeadline = Date.now() + 30000;
  while (Date.now() < resolutionDeadline) {
    const current = await pilotState();
    const selected = (current?.ledger || []).filter(item => Object.values(questions).includes(item?.envelope?.text));
    if (selected.length === 3 && selected.every(item => item.state === 'proven')) break;
    if (current?.batchState?.pendingNoResponse) {
      await dashboard.evaluate(`document.querySelector('[data-view="assist"]')?.click(); true`, { userGesture: true });
      const control = await waitFor('explicit no-response Continue choice ready', async () => {
        const raw = await dashboard.evaluate(`(()=>{const button=document.querySelector('[data-choice-option="continue"]');const panel=document.getElementById('panelAssist');const visible=Boolean(button&&(button.offsetWidth||button.offsetHeight||button.getClientRects().length));return JSON.stringify({exists:Boolean(button),hidden:Boolean(button?.hidden),disabled:Boolean(button?.disabled),visible,assistActive:Boolean(panel?.classList.contains('active')),choiceId:String(button?.dataset?.choiceId||''),fingerprint:String(button?.dataset?.fingerprint||'')})})()`);
        const value = JSON.parse(raw);
        return { ok: value.exists && !value.hidden && !value.disabled && value.visible && value.assistActive && value.choiceId && value.fingerprint, value };
      }, 10000, 100);
      const continued = await dashboard.evaluate(`(()=>{const button=document.querySelector('[data-choice-option="continue"]');if(!button||button.hidden||button.disabled)return false;button.click();return true})()`, { userGesture: true });
      if (!continued) throw new Error('Explicit no-response Continue choice was ready but could not be clicked');
      evidence.noResponseResolution = { required: true, action: 'continue', completedAt: Date.now(), control: control.value };
      break;
    }
    await sleep(250);
  }

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
  const drillControl = await waitFor('transport drill control ready', async () => {
    const raw = await dashboard.evaluate(`(()=>{const button=document.getElementById('runTransportDrill');const panel=document.querySelector('[data-view-panel="review"]');const visible=Boolean(button&&(button.offsetWidth||button.offsetHeight||button.getClientRects().length));return JSON.stringify({exists:Boolean(button),disabled:Boolean(button?.disabled),hidden:Boolean(button?.hidden),visible,reviewActive:Boolean(panel?.classList.contains('active')),busy:String(button?.dataset?.busy||'false')})})()`);
    const value = JSON.parse(raw);
    return { ok: value.exists && value.visible && value.reviewActive && !value.hidden && !value.disabled, value };
  }, 30000, 100);
  evidence.transportDrillControl = drillControl.value;
  const drillClicked = await dashboard.evaluate(`(()=>{const button=document.getElementById('runTransportDrill');if(!button||button.disabled||button.hidden)return false;button.click();return true})()`, { userGesture: true });
  if (!drillClicked) throw new Error('Transport drill control was ready but could not be clicked');
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
    await dashboard.evaluate(`document.querySelector('[data-view="review"]')?.click(); true`, { userGesture: true });
    await waitFor(`Review evidence ready (${label})`, async () => {
      const raw = await dashboard.evaluate(`(()=>{const panel=document.querySelector('[data-view-panel="review"]');const report=document.getElementById('transportDrillReport')?.textContent||'';return JSON.stringify({reviewActive:Boolean(panel?.classList.contains('active')),drillReportReady:report.includes('handshake'),traceResultCount:document.querySelectorAll('[data-trace-id]').length})})()`);
      const value = JSON.parse(raw);
      return { ok: value.reviewActive && value.drillReportReady && value.traceResultCount >= 3, value };
    }, 10000, 100);
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

  async function productionUiState(width, height, label) {
    await dashboard.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await dashboard.evaluate(`document.querySelector('[data-view="production"]')?.click(); true`, { userGesture: true });
    await waitFor(`Production evidence ready (${label})`, async () => {
      const raw = await dashboard.evaluate(`(()=>{const panel=document.getElementById('panelProduction');const health=(document.getElementById('productionHealthBadge')?.textContent||'').trim();const transport=(document.getElementById('transportAssuranceState')?.textContent||'').trim();const route=(document.getElementById('routeReadinessState')?.textContent||'').trim();return JSON.stringify({productionActive:Boolean(panel?.classList.contains('active')),health,transport,route})})()`);
      const value = JSON.parse(raw);
      return { ok: value.productionActive && value.health && value.health !== 'Waiting' && value.transport && value.transport !== 'Waiting' && value.route && value.route !== 'Waiting', value };
    }, 10000, 100);
    const raw = await dashboard.evaluate(`(()=>{
      const required=['panelProduction','productionDecisionTitle','operatingProfileSelect','containmentState','transportAssuranceState','routeReadinessState','upgradeReadinessState','liveScoreValue','productionDiagnosticsState','releaseHandoffState','downloadHandoffManifest'];
      const panel=document.getElementById('panelProduction');
      const grid=document.querySelector('.production-grid');
      return JSON.stringify({
        viewport:{width:innerWidth,height:innerHeight},
        scrollWidth:document.documentElement.scrollWidth,
        horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
        required:Object.fromEntries(required.map(id=>[id,Boolean(document.getElementById(id))])),
        productionActive:Boolean(panel?.classList.contains('active')),
        controlCount:panel?.querySelectorAll('button,input,select').length||0,
        gridColumns:grid?getComputedStyle(grid).gridTemplateColumns:'',
        health:(document.getElementById('productionHealthBadge')?.textContent||'').trim(),
        decision:(document.getElementById('productionDecisionTitle')?.textContent||'').trim(),
        transport:(document.getElementById('transportAssuranceState')?.textContent||'').trim(),
        route:(document.getElementById('routeReadinessState')?.textContent||'').trim(),
        release:(document.getElementById('releaseHandoffState')?.textContent||'').trim(),
        accessibility:{polite:Boolean(document.querySelector('[aria-live="polite"]')),assertive:Boolean(document.querySelector('[aria-live="assertive"]'))}
      });
    })()`);
    const value = JSON.parse(raw);
    const screenshot = await dashboard.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const screenshotPath = path.join(path.dirname(evidencePath), `production-${label}.png`);
    await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    return { ...value, screenshotPath };
  }

  async function assistUiState(width, height, label) {
    await dashboard.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await dashboard.evaluate(`document.querySelector('[data-view="assist"]')?.click(); true`, { userGesture: true });
    await waitFor(`Assist evidence ready (${label})`, async () => {
      const raw = await dashboard.evaluate(`(()=>{const panel=document.getElementById('panelAssist');const title=(document.getElementById('assistChoiceTitle')?.textContent||'').trim();const reliabilityState=(document.getElementById('assistReliabilityState')?.textContent||'').trim();const reliabilityRows=document.querySelectorAll('#assistReliabilityGroups .reliability-list li').length;return JSON.stringify({assistActive:Boolean(panel?.classList.contains('active')),title,reliabilityState,reliabilityRows})})()`);
      const value=JSON.parse(raw);return { ok:value.assistActive&&Boolean(value.title)&&Boolean(value.reliabilityState)&&value.reliabilityState!=='Waiting'&&value.reliabilityRows===20,value };
    },10000,100);
    const raw=await dashboard.evaluate(`(()=>{const required=['panelAssist','choiceWorkspace','assistChoiceTitle','assistMilestones','assistTriageItems','assistRouteState','assistRecoveryState','assistCommandHistory','assistForecastState','assistPolicyTitle','assistWizardSteps','assistReliabilityState','assistReliabilityGroups','liveActionDock','dockPrimaryAction'];const panel=document.getElementById('panelAssist');return JSON.stringify({viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,required:Object.fromEntries(required.map(id=>[id,Boolean(document.getElementById(id))])),assistActive:Boolean(panel?.classList.contains('active')),controlCount:panel?.querySelectorAll('button,input,select').length||0,actionDock:Boolean(document.getElementById('liveActionDock')),reliabilityState:(document.getElementById('assistReliabilityState')?.textContent||'').trim(),reliabilityRows:document.querySelectorAll('#assistReliabilityGroups .reliability-list li').length,accessibility:{polite:Boolean(document.querySelector('[aria-live="polite"]')),assertive:Boolean(document.querySelector('[aria-live="assertive"]'))}})})()`);
    const value=JSON.parse(raw);const screenshot=await dashboard.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const screenshotPath=path.join(path.dirname(evidencePath),`assist-${label}.png`);await fs.writeFile(screenshotPath,Buffer.from(screenshot.data,'base64'));return {...value,screenshotPath};
  }

  async function operationsUiState(width, height, label) {
    await dashboard.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await dashboard.evaluate(`document.querySelector('[data-view="assist"]')?.click(); true`, { userGesture: true });
    await waitFor(`Operations Lab ready (${label})`, async () => {
      const raw = await dashboard.evaluate(`(()=>{const panel=document.getElementById('panelAssist');const lab=document.getElementById('operationsLab');return JSON.stringify({assistActive:Boolean(panel?.classList.contains('active')),viewCount:document.querySelectorAll('#operationsLabTabs [role="tab"]').length,itemCount:document.querySelectorAll('#operationsLabPanel [data-operations-lab-item]').length,privacy:String(lab?.dataset?.privacy||''),summary:(document.getElementById('operationsLabSummary')?.textContent||'').trim()})})()`);
      const value=JSON.parse(raw);
      return { ok:value.assistActive&&value.viewCount===10&&value.itemCount===4&&value.privacy==='safe'&&Boolean(value.summary), value };
    },10000,100);
    const before=await pilotState();
    const interactionRaw=await dashboard.evaluate(`(()=>{const first=document.querySelector('[data-operations-lab-view="flow"]');first?.focus();first?.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));const keyboardMoved=document.querySelector('[data-operations-lab-view="transport"]')?.getAttribute('aria-selected')==='true';const scenario=document.getElementById('operationsLabScenario');if(scenario){scenario.value='network_loss';scenario.dispatchEvent(new Event('change',{bubbles:true}));}return JSON.stringify({keyboardMoved,scenario:String(document.getElementById('operationsLab')?.dataset?.scenario||''),itemCount:document.querySelectorAll('#operationsLabPanel [data-operations-lab-item]').length})})()`,{userGesture:true});
    const interaction=JSON.parse(interactionRaw);
    await waitFor(`Operations Lab scenario rendered (${label})`,async()=>{
      const raw=await dashboard.evaluate(`(()=>JSON.stringify({scenario:String(document.getElementById('operationsLab')?.dataset?.scenario||''),items:document.querySelectorAll('#operationsLabPanel [data-operations-lab-item]').length}))()`);
      const value=JSON.parse(raw);
      return { ok:value.scenario==='network_loss'&&value.items===4, value };
    },5000,50);
    const raw=await dashboard.evaluate(`(()=>{const required=['operationsLab','operationsLabSummary','operationsLabPrivacy','operationsLabTabs','operationsLabScenario','operationsLabScenarioDetail','operationsLabPanel'];const lab=document.getElementById('operationsLab');return JSON.stringify({viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,required:Object.fromEntries(required.map(id=>[id,Boolean(document.getElementById(id))])),viewCount:document.querySelectorAll('#operationsLabTabs [role="tab"]').length,scenarioCount:document.querySelectorAll('#operationsLabScenario option').length,itemCount:document.querySelectorAll('#operationsLabPanel [data-operations-lab-item]').length,privacy:String(lab?.dataset?.privacy||''),view:String(lab?.dataset?.view||''),scenario:String(lab?.dataset?.scenario||''),aria:{tablist:document.getElementById('operationsLabTabs')?.getAttribute('role')||'',tabpanel:document.getElementById('operationsLabPanel')?.getAttribute('role')||'',selected:document.querySelectorAll('#operationsLabTabs [aria-selected="true"]').length}})})()`);
    const value=JSON.parse(raw);
    const after=await pilotState();
    value.commandJournalDelta=Math.max(0,(after?.commandJournal?.length||0)-(before?.commandJournal?.length||0));
    value.keyboardMoved=interaction.keyboardMoved;
    const screenshot=await dashboard.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const screenshotPath=path.join(path.dirname(evidencePath),`operations-${label}.png`);
    await fs.writeFile(screenshotPath,Buffer.from(screenshot.data,'base64'));
    await dashboard.evaluate(`(()=>{document.querySelector('[data-operations-lab-view="flow"]')?.click();const scenario=document.getElementById('operationsLabScenario');if(scenario){scenario.value='current';scenario.dispatchEvent(new Event('change',{bubbles:true}));}return true})()`,{userGesture:true});
    return { ...value, screenshotPath };
  }

  const desktopUi = await dashboardUiState(1200, 900, 'desktop');
  const mobileUi = await dashboardUiState(320, 900, '320px');
  const tinyUi = await dashboardUiState(280, 900, '280px');
  const productionDesktop = await productionUiState(1200, 900, 'desktop');
  const productionMobile = await productionUiState(320, 900, '320px');
  const productionTiny = await productionUiState(280, 900, '280px');
  const assistDesktop = await assistUiState(1200, 900, 'desktop');
  const assistMobile = await assistUiState(320, 900, '320px');
  const assistTiny = await assistUiState(280, 900, '280px');
  const operationsDesktop = await operationsUiState(1200, 900, 'desktop');
  const operationsMobile = await operationsUiState(320, 900, '320px');
  const operationsTiny = await operationsUiState(280, 900, '280px');
  await dashboard.send('Emulation.setEmulatedMedia', { media: 'print' });
  const printUi = await dashboardUiState(1200, 900, 'print');
  const productionPrint = await productionUiState(1200, 900, 'print');
  const assistPrint = await assistUiState(1200, 900, 'print');
  const operationsPrint = await operationsUiState(1200, 900, 'print');
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
  evidence.assistUi = { desktop: assistDesktop, mobile: assistMobile, tiny: assistTiny, print: assistPrint };
  evidence.reliabilityUiOk = [assistDesktop, assistMobile, assistTiny, assistPrint].every(value => Boolean(value.reliabilityState) && value.reliabilityState !== 'Waiting' && value.reliabilityRows === 20);
  evidence.assistUiOk = evidence.reliabilityUiOk && [assistDesktop, assistMobile, assistTiny, assistPrint].every(value => (!value.horizontalOverflow && value.assistActive && value.actionDock && value.controlCount > 0 && Object.values(value.required).every(Boolean) && value.accessibility.polite && value.accessibility.assertive));
  evidence.operationsUi = { desktop:operationsDesktop, mobile:operationsMobile, tiny:operationsTiny, print:operationsPrint };
  evidence.operationsUiOk = [operationsDesktop,operationsMobile,operationsTiny,operationsPrint].every(value => (
    !value.horizontalOverflow
    && Object.values(value.required).every(Boolean)
    && value.viewCount===10 && value.scenarioCount===5 && value.itemCount===4
    && value.privacy==='safe' && value.keyboardMoved===true && value.commandJournalDelta===0
    && value.aria.tablist==='tablist' && value.aria.tabpanel==='tabpanel' && value.aria.selected===1
  ));
  evidence.productionUi = { desktop: productionDesktop, mobile: productionMobile, tiny: productionTiny, print: productionPrint };
  evidence.productionUiOk = [productionDesktop, productionMobile, productionTiny, productionPrint].every(value => (
    !value.horizontalOverflow
    && value.productionActive
    && Object.values(value.required).every(Boolean)
    && value.health && value.health !== 'Waiting'
    && value.decision
    && value.transport && value.transport !== 'Waiting'
    && value.route && value.route !== 'Waiting'
    && value.release
    && value.accessibility.polite
    && value.accessibility.assertive
  ));

  evidence.deliveryProofOk = proof.value.deliveryProofOk && evidence.outbox.count === 0 && evidence.gap.clear;
  evidence.ok = evidence.deliveryProofOk && evidence.transportDrillOk && evidence.pilotUiOk && evidence.productionUiOk && evidence.assistUiOk && evidence.reliabilityUiOk && evidence.operationsUiOk;
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

console.log(JSON.stringify({ ok: evidence.ok, evidencePath, deliveryProofOk: evidence.deliveryProofOk, transportDrillOk: evidence.transportDrillOk, pilotUiOk: evidence.pilotUiOk, productionUiOk: evidence.productionUiOk, selfTest: evidence.selfTest?.ok === true, outbox: evidence.outbox, gap: evidence.gap, answerCapability: evidence.answerCapability, limitations: evidence.limitations }, null, 2));
if (failure || !evidence.ok) process.exit(1);