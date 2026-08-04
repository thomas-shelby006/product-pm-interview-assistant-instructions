import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveReleaseVerificationStatus } from './release-verification-status.mjs';

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
const operationsHandlerStart = dashboardSource.indexOf("byId('operationsLabScenario').addEventListener");
const operationsHandlerEnd = dashboardSource.indexOf("byId('assistCommandSearch').addEventListener", operationsHandlerStart);
const operationsHandlerSource = operationsHandlerStart >= 0 && operationsHandlerEnd > operationsHandlerStart
  ? dashboardSource.slice(operationsHandlerStart, operationsHandlerEnd)
  : '';
const operationsCommandIsolation = {
  ok: Boolean(operationsHandlerSource) && !/\b(?:sendCommand|runCommand)\s*\(/.test(operationsHandlerSource),
  handlerStart: operationsHandlerStart,
  handlerEnd: operationsHandlerEnd
};
if (!operationsCommandIsolation.ok) throw new Error('Operations Lab handlers are not command-isolated');
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
const chatGptMessageSelector = [
  '[data-message-author-role="user"]',
  '[data-message-author-role="assistant"]',
  '[data-conversation-transcript] [data-message-role="user"]',
  '[data-conversation-transcript] [data-message-role="assistant"]'
].join(',');
const chatGptCompactTextSelectors = [
  '[data-user-message-copy]',
  '[data-user-message-bubble]',
  '[data-submit-message-animation-target]'
];

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
  version: '2.0',
  sourceCommit,
  commit: sourceCommit,
  generatedAt: new Date().toISOString(),
  isolatedProfile: { path: profilePath, temporary: true, normalProfileTouched: false },
  extensions: [],
  session: { id: session, senderTarget: '', receiverTarget: '', dashboardTarget: '' },
  commandReachability,
  commandRegistryDigest,
  operationsCommandIsolation,
  selfTest: { ok: false },
  sourceSubmission: { attempts: 0, rendered: false },
  manualCopyAdmissions: [],
  adaptiveTurnScenarios: {
    authoritativeFinal: { ok: false },
    pauseResume: { ok: false },
    carryover: { ok: false },
    independentAccumulation: { ok: false },
    restartRecovery: { ok: false }
  },
  adaptiveTurnScenariosOk: false,
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
  cdpReadRecoveries: [],
  cleanup: { processTreeClosed: false, profileRemoved: false },
  limitations: [],
  deliveryProofOk: false,
  deterministicBrowser: { ok: false, checks: {} },
  providerCanary: { status: 'skipped', reason: '', deliveryProofOk: false },
  releaseVerification: { status: 'deterministic_failed', packageReady: false, activationReady: false },
  ok: false
};

let worker = null;
let sender = null;
let receiver = null;
let dashboard = null;
let senderTarget = '';
let receiverTarget = '';
let dashboardTarget = '';
let failure = null;

function clientForRole(role) {
  if (role === 'sender') return sender;
  if (role === 'receiver') return receiver;
  if (role === 'dashboard') return dashboard || worker;
  return worker;
}
function targetForRole(role) {
  if (role === 'sender') return senderTarget;
  if (role === 'receiver') return receiverTarget;
  if (role === 'dashboard') return dashboardTarget;
  return '';
}
function setClientForRole(role, client) {
  if (role === 'sender') sender = client;
  else if (role === 'receiver') receiver = client;
  else if (role === 'dashboard') dashboard = client;
}
async function evaluateRead(role, expression, label = role) {
  const first = clientForRole(role);
  if (!first) throw new Error(`CDP read client missing: ${role}`);
  try {
    return await first.evaluate(expression);
  } catch (error) {
    const detail = String(error?.message || error);
    const targetId = targetForRole(role);
    if (!targetId || !/Runtime\.evaluate timed out|WebSocket|socket|closed/i.test(detail)) throw error;
    evidence.cdpReadRecoveries.push({ role, label, reason: detail, at: Date.now() });
    try { first.close(); } catch {}
    const replacement = await targetClient(targetId);
    setClientForRole(role, replacement);
    return replacement.evaluate(expression);
  }
}
async function pilotState() {
  const role = dashboard ? 'dashboard' : 'worker';
  const raw = await evaluateRead(role, `(async()=>{const value=await chrome.storage.session.get('pmia_runtime_pilot_v1');const stored=value.pmia_runtime_pilot_v1;const sessions=Array.isArray(stored)?stored:(Array.isArray(stored?.sessions)?stored.sessions:[]);return JSON.stringify(sessions.find(item=>item.sessionId===${JSON.stringify(session)})||null)})()`, 'pilot_state');
  return JSON.parse(raw);
}
async function pageState(role) {
  const raw = await evaluateRead(role, `(()=>{
    const composer=[...document.querySelectorAll(${JSON.stringify(chatGptComposerSelector)})].find(node=>node.offsetWidth||node.offsetHeight||node.getClientRects().length);
    const text=node=>String(node?.innerText||node?.textContent||'').trim();
    const roleOf=node=>String(node?.getAttribute?.('data-message-author-role')||node?.getAttribute?.('data-message-role')||'').trim().toLowerCase();
    const isChrome=node=>Boolean(node?.getAttribute?.('data-message-attribution')!==null||node?.getAttribute?.('data-message-actions')!==null||node?.getAttribute?.('data-assistant-message-actions')!==null||node?.getAttribute?.('data-conversation-inline-beacon-slot')!==null);
    const compactText=node=>{
      for(const selector of ${JSON.stringify(chatGptCompactTextSelectors)}){const candidate=node?.querySelector?.(selector);const value=text(candidate);if(value)return value;}
      const candidates=[...(node?.children||[])].filter(child=>!isChrome(child)).map(text).filter(Boolean).sort((left,right)=>right.length-left.length);
      return candidates[0]||text(node);
    };
    const messages=[...document.querySelectorAll(${JSON.stringify(chatGptMessageSelector)})]
      .map(node=>({role:roleOf(node),text:node?.getAttribute?.('data-message-role')?compactText(node):text(node)}))
      .filter(item=>['user','assistant'].includes(item.role)&&item.text);
    return JSON.stringify({
      title:document.title,
      url:location.href,
      composer:composer?String('value' in composer?composer.value:composer.innerText||'').trim():'',
      users:messages.filter(item=>item.role==='user').map(item=>item.text),
      assistants:messages.filter(item=>item.role==='assistant').map(item=>item.text),
      stopAvailable:[...document.querySelectorAll('button')].some(button=>/stop generating|stop response|stop streaming/i.test([button.getAttribute('aria-label'),button.getAttribute('data-testid'),button.innerText].join(' ')))
    });
  })()`, `${role}_page_state`);
  return JSON.parse(raw);
}
async function manualCopy(text) {
  return sender.evaluate(`(()=>{const node=document.createElement('div');node.textContent=${JSON.stringify(text)};node.style.cssText='position:fixed;left:-9999px;top:-9999px;white-space:pre-wrap';document.body.append(node);const range=document.createRange();range.selectNodeContents(node);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('copy',{bubbles:true,cancelable:true}));selection.removeAllRanges();node.remove();return true})()`, { userGesture: true });
}

async function manualCopyAndAwaitOwnership(label, text) {
  const copied = await manualCopy(text);
  if (!copied) throw new Error(`${label} manual copy was not dispatched`);
  const admitted = await waitFor(`${label} admitted to durable ownership`, async () => {
    const pilot = await pilotState();
    const entry = (pilot?.ledger || []).find(item => item?.envelope?.text === text);
    return {
      ok: Boolean(entry),
      value: entry ? { id: entry.id, seq: Number(entry.envelope?.seq || 0), state: entry.state } : null
    };
  }, 30000, 250);
  evidence.manualCopyAdmissions.push({ label, text, ...admitted.value, admittedAt: Date.now() });
  return admitted.value;
}

async function awaitPausedBatchProjection(label, admission, text) {
  return waitFor(`${label} projected into paused receiver batch`, async () => {
    const pilot = await pilotState();
    const state = await pageState('receiver');
    const memberIds = (pilot?.batchState?.next?.memberIds || []).map(String);
    return {
      ok: memberIds.includes(String(admission.id)) && state.composer.includes(text),
      value: { memberIds, questionCount: Number(pilot?.batchState?.next?.questionCount || 0), composerHasText: state.composer.includes(text) }
    };
  }, 30000, 250);
}

async function runAdaptiveModuleScenarios(client) {
  if (!client) throw new Error('Adaptive scenario extension-page client missing');
  const raw = await client.evaluate(`(async()=>{
    const [{createReceiverBatchRuntime},{BatchPlanner},{RuntimePilotState}]=await Promise.all([
      import(chrome.runtime.getURL('content/receiver-batch-runtime.js')),
      import(chrome.runtime.getURL('shared/batch-planner.js')),
      import(chrome.runtime.getURL('shared/runtime-pilot-state.js'))
    ]);
    const envelope=(id,seq,metadata={})=>({id,sessionId:'browser-scenario',sourceProvider:'chatgpt',kind:'question',seq,text:'Synthetic '+id,metadata,createdAt:seq});
    let clock=100;let generating=false;let stopCalls=0;const submissions=[];
    const runtime=createReceiverBatchRuntime({
      adapter:{provider:'chatgpt',isGenerating:()=>generating,stopGenerating:()=>{stopCalls+=1;generating=false;return true;},setComposerText:()=>true},
      submitBatch:async batch=>{submissions.push({batchId:batch.id,memberIds:[...batch.prompt.memberIds],coordinationMode:String(batch.prompt.coordinationMode||'')});return {ok:true,proof:{ok:true,verified:true}};},
      nowFn:()=>++clock,waitFn:async()=>{},cancelActiveAnswer:async()=>({ok:true})
    });
    await runtime.accept(envelope('q1',1,{sourceTurnId:'turn-1',boundary:'rendered_user_turn'}));
    generating=true;
    const independent=await runtime.accept(envelope('q2',2,{sourceTurnId:'turn-2',boundary:'rendered_user_turn'}));
    const independentSnapshot=runtime.snapshot();
    const stopsBeforeCarryover=stopCalls;
    const carryover=await runtime.accept(envelope('q3',3,{sourceTurnId:'turn-1',continuationOf:'turn-1',revisionOf:'q1',boundary:'rendered_user_turn_revision',sourceOutcome:'interrupted',generationToken:'browser-generation-1'}));
    const carryoverSnapshot=runtime.snapshot();

    let restartClock=1000;const restartSubmissions=[];
    const paused=createReceiverBatchRuntime({
      adapter:{provider:'chatgpt',isGenerating:()=>false,setComposerText:()=>true},
      submitBatch:async batch=>{restartSubmissions.push([...batch.prompt.memberIds]);return {ok:true,proof:{ok:true,verified:true}};},
      nowFn:()=>++restartClock
    });
    await paused.pauseForwarding();
    await paused.accept(envelope('r1',1));
    await paused.accept(envelope('r2',2));
    const checkpoint=paused.snapshot();
    const pilot=new RuntimePilotState([], {nowFn:()=>restartClock});
    pilot.updateBatchState('restart',{type:'forwarding_paused',turnCoordination:checkpoint.turnCoordination},restartClock);
    const restoredPilot=new RuntimePilotState(pilot.exportState(), {nowFn:()=>restartClock+1});
    const restored=createReceiverBatchRuntime({
      planner:new BatchPlanner(checkpoint),turnCoordinationState:checkpoint.turnCoordination,
      adapter:{provider:'chatgpt',isGenerating:()=>false,setComposerText:()=>true},
      submitBatch:async batch=>{restartSubmissions.push([...batch.prompt.memberIds]);return {ok:true,proof:{ok:true,verified:true}};},
      nowFn:()=>++restartClock
    });
    const restoredBefore=restored.snapshot();
    const restartResult=await restored.resumeForwarding({submit:true});
    const replacement=submissions.at(-1)||{};
    return JSON.stringify({
      carryover:{ok:carryover?.ok===true&&stopCalls===1&&replacement.memberIds?.join(',')==='q1,q3',stopCalls,replacementMemberIds:replacement.memberIds||[],preservedNextIds:(carryoverSnapshot.next?.entries||[]).map(item=>String(item.id)),chainId:String(carryover?.correlation?.chainId||'')},
      independentAccumulation:{ok:independent?.reason==='receiver_busy'&&stopsBeforeCarryover===0&&(independentSnapshot.next?.entries||[]).some(item=>String(item.id)==='q2'),reason:String(independent?.reason||''),stopCalls:stopsBeforeCarryover,nextMemberIds:(independentSnapshot.next?.entries||[]).map(item=>String(item.id))},
      restartRecovery:{ok:restoredBefore.turnCoordination?.mode==='paused_accumulating'&&restoredPilot.snapshot('restart',restartClock+1)?.batchState?.turnCoordination?.mode==='paused_accumulating'&&restartResult?.ok===true&&restartSubmissions.at(-1)?.join(',')==='r1,r2',restoredMode:String(restoredBefore.turnCoordination?.mode||''),submittedMemberIds:restartSubmissions.at(-1)||[],pilotRestored:true}
    });
  })()`);
  return JSON.parse(raw);
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
  senderTarget = (await browser.send('Target.createTarget', { url: senderUrl, newWindow: true, background: true })).targetId;
  receiverTarget = (await browser.send('Target.createTarget', { url: receiverUrl, newWindow: true, background: true })).targetId;
  dashboardTarget = (await browser.send('Target.createTarget', { url: dashboardUrl, newWindow: true, background: true })).targetId;
  createdTargets.push(senderTarget, receiverTarget, dashboardTarget);
  evidence.session = { id: session, senderTarget, receiverTarget, dashboardTarget };

  const sampleManagedLifecycle = async () => {
    const values = await targets();
    const selected = values.filter(value => createdTargets.includes(value.id));
    const suffix = session.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
    const senderReady = selected.some(value => value.id === senderTarget && value.title === `PMIA_SENDER_CHATGPT_${suffix}`);
    const receiverReady = selected.some(value => value.id === receiverTarget && value.title === `PMIA_RECEIVER_CHATGPT_${suffix}`);
    const dashboardReady = selected.some(value => value.id === dashboardTarget && value.url === dashboardUrl);
    return { ok: senderReady && receiverReady && dashboardReady, value: selected.map(value => ({ id: value.id, title: value.title, url: value.url })) };
  };
  const suffix = session.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
  const expectedSenderTitle = `PMIA_SENDER_CHATGPT_${suffix}`;
  const expectedReceiverTitle = `PMIA_RECEIVER_CHATGPT_${suffix}`;
  async function navigateManagedTarget(targetId, url) {
    const client = await targetClient(targetId);
    try { await client.send('Page.navigate', { url }); }
    finally { client.close(); }
  }
  async function replaceManagedTarget(targetId, url) {
    const replacement = (await browser.send('Target.createTarget', { url, newWindow: true, background: true })).targetId;
    createdTargets.push(replacement);
    await browser.send('Target.closeTarget', { targetId }).catch(() => {});
    return replacement;
  }
  evidence.lifecycleRecovery = { attempted: false, providerNavigations: 0, providerReplacements: 0, recovered: false };
  try {
    await waitFor('managed lifecycle ready', sampleManagedLifecycle, 30000, 500);
  } catch (initialLifecycleError) {
    evidence.lifecycleRecovery.attempted = true;
    evidence.lifecycleRecovery.initialFailure = String(initialLifecycleError?.message || initialLifecycleError);
    const initialTargets = await targets();
    const senderReady = initialTargets.some(value => value.id === senderTarget && value.title === expectedSenderTitle);
    const receiverReady = initialTargets.some(value => value.id === receiverTarget && value.title === expectedReceiverTitle);
    if (!senderReady) { await navigateManagedTarget(senderTarget, senderUrl); evidence.lifecycleRecovery.providerNavigations += 1; }
    if (!receiverReady) { await navigateManagedTarget(receiverTarget, receiverUrl); evidence.lifecycleRecovery.providerNavigations += 1; }

    try {
      const recovered = await waitFor('managed lifecycle ready after provider navigation', sampleManagedLifecycle, 45000, 500);
      evidence.lifecycleRecovery.recovered = recovered.ok;
    } catch (navigationError) {
      evidence.lifecycleRecovery.navigationFailure = String(navigationError?.message || navigationError);
      const navigatedTargets = await targets();
      const senderRecovered = navigatedTargets.some(value => value.id === senderTarget && value.title === expectedSenderTitle);
      const receiverRecovered = navigatedTargets.some(value => value.id === receiverTarget && value.title === expectedReceiverTitle);
      if (!senderRecovered) { senderTarget = await replaceManagedTarget(senderTarget, senderUrl); evidence.lifecycleRecovery.providerReplacements += 1; }
      if (!receiverRecovered) { receiverTarget = await replaceManagedTarget(receiverTarget, receiverUrl); evidence.lifecycleRecovery.providerReplacements += 1; }
      evidence.session = { id: session, senderTarget, receiverTarget, dashboardTarget };
      const recovered = await waitFor('managed lifecycle ready after provider replacement', sampleManagedLifecycle, 60000, 500);
      evidence.lifecycleRecovery.recovered = recovered.ok;
    }
  }

  sender = await targetClient(senderTarget);
  receiver = await targetClient(receiverTarget);
  dashboard = await targetClient(dashboardTarget);

  const moduleScenarios = await runAdaptiveModuleScenarios(dashboard);
  evidence.adaptiveTurnScenarios.carryover = moduleScenarios.carryover;
  evidence.adaptiveTurnScenarios.independentAccumulation = moduleScenarios.independentAccumulation;
  evidence.adaptiveTurnScenarios.restartRecovery = moduleScenarios.restartRecovery;
  if (!moduleScenarios.carryover?.ok || !moduleScenarios.independentAccumulation?.ok || !moduleScenarios.restartRecovery?.ok) {
    throw new Error(`Adaptive module scenarios failed: ${JSON.stringify(moduleScenarios)}`);
  }

  await dashboard.evaluate(`document.querySelector('[data-command="run_self_test"]')?.click(); true`, { userGesture: true });
  const selfTest = await waitFor('active no-content self-test', async () => {
    const pilot = await pilotState();
    return { ok: pilot?.selfTest?.ok === true, value: pilot?.selfTest || null };
  }, 20000, 250);
  evidence.selfTest = selfTest.value;

  async function submitSyntheticQ1Attempt(attempt) {
    const before = await pageState('sender');
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
        const value = await pageState('sender');
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
          const value = await pageState('sender');
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
    const state = await pageState('receiver');
    return { ok: state.users.includes(questions.q1), value: state };
  }, 90000, 500);
  const authoritative = await waitFor('authoritative ChatGPT final admitted', async () => {
    const pilot = await pilotState();
    const entry = (pilot?.ledger || []).find(item => item?.envelope?.text === questions.q1);
    const boundary = String(entry?.envelope?.metadata?.boundary || '');
    return { ok: Boolean(entry && ['rendered_user_turn','assistant_successor','explicit_copied_final'].includes(boundary)), value: entry ? { id:entry.id, seq:Number(entry.envelope?.seq||0), state:entry.state, boundary } : null };
  }, 30000, 250);
  evidence.adaptiveTurnScenarios.authoritativeFinal = { ok:true, ...authoritative.value };

  const pauseClicked = await dashboard.evaluate(`(()=>{const button=document.getElementById('turnCoordinationPrimary');if(!button||button.dataset.command!=='pause'||button.disabled)return false;button.click();return true})()`, { userGesture: true });
  if (!pauseClicked) throw new Error('Turn Coordination Pause action was unavailable');
  await waitFor('forwarding pause committed', async () => {
    const pilot = await pilotState();
    return { ok: pilot?.mode === 'paused' && pilot?.batchState?.turnCoordination?.mode === 'paused_accumulating', value: pilot?.batchState?.turnCoordination || null };
  }, 20000, 100);

  const q2Admission = await manualCopyAndAwaitOwnership('Q2', questions.q2);
  await awaitPausedBatchProjection('Q2', q2Admission, questions.q2);
  const q3Admission = await manualCopyAndAwaitOwnership('Q3', questions.q3);
  await awaitPausedBatchProjection('Q3', q3Admission, questions.q3);
  const pausedDraft = await waitFor('paused combined draft mirrored in Window 2', async () => {
    const pilot = await pilotState();
    const state = await pageState('receiver');
    const ids = (pilot?.batchState?.next?.memberIds || []).map(String);
    const expected = [q2Admission.id, q3Admission.id].every(id => ids.includes(String(id)));
    return { ok: expected && /FORWARDING PAUSED/i.test(state.composer) && state.composer.includes(questions.q2) && state.composer.includes(questions.q3), value: { memberIds:ids, composerBanner:/FORWARDING PAUSED/i.test(state.composer), questionCount:Number(pilot?.batchState?.next?.questionCount||0) } };
  }, 30000, 250);

  const resumeReady = await waitFor('Resume and send control ready', async () => {
    const raw = await dashboard.evaluate(`(()=>{const button=document.getElementById('turnCoordinationPrimary');return JSON.stringify({command:String(button?.dataset?.command||''),disabled:Boolean(button?.disabled),hidden:Boolean(button?.hidden)})})()`);
    const value = JSON.parse(raw);
    return { ok: value.command === 'resume_catch_up' && !value.disabled && !value.hidden, value };
  }, 15000, 100);
  const resumeClicked = await dashboard.evaluate(`(()=>{const button=document.getElementById('turnCoordinationPrimary');if(!button||button.dataset.command!=='resume_catch_up'||button.disabled)return false;button.click();return true})()`, { userGesture: true });
  if (!resumeClicked) throw new Error('Turn Coordination Resume and send action was unavailable');
  const resumed = await waitFor('forwarding resume committed', async () => {
    const pilot = await pilotState();
    const mode = String(pilot?.batchState?.turnCoordination?.mode || '');
    return { ok: pilot?.mode === 'active' && mode !== 'paused_accumulating', value: { mode, pilotMode:pilot?.mode } };
  }, 20000, 100);
  evidence.adaptiveTurnScenarios.pauseResume = { ok:true, paused:pausedDraft.value, resumeControl:resumeReady.value, resumed:resumed.value };

  evidence.noResponseResolution = { required: false, action: '', completedAt: 0 };

  async function resolvePendingNoResponse(current) {
    if (!current?.batchState?.pendingNoResponse || evidence.noResponseResolution.completedAt) return false;
    await dashboard.evaluate(`document.querySelector('[data-view="assist"]')?.click(); true`, { userGesture: true });
    const control = await waitFor('explicit no-response Continue choice ready', async () => {
      const raw = await dashboard.evaluate(`(()=>{const button=document.querySelector('[data-choice-option="continue"]');const panel=document.getElementById('panelAssist');const visible=Boolean(button&&(button.offsetWidth||button.offsetHeight||button.getClientRects().length));return JSON.stringify({exists:Boolean(button),hidden:Boolean(button?.hidden),disabled:Boolean(button?.disabled),visible,assistActive:Boolean(panel?.classList.contains('active')),choiceId:String(button?.dataset?.choiceId||''),fingerprint:String(button?.dataset?.fingerprint||'')})})()`);
      const value = JSON.parse(raw);
      return { ok: value.exists && !value.hidden && !value.disabled && value.visible && value.assistActive && value.choiceId && value.fingerprint, value };
    }, 10000, 100);
    const continued = await dashboard.evaluate(`(()=>{const button=document.querySelector('[data-choice-option="continue"]');if(!button||button.hidden||button.disabled)return false;button.click();return true})()`, { userGesture: true });
    if (!continued) throw new Error('Explicit no-response Continue choice was ready but could not be clicked');
    evidence.noResponseResolution = { required: true, action: 'continue', completedAt: Date.now(), control: control.value };
    return true;
  }

  let providerPilot = null;
  let providerReceiverState = { users: [], assistants: [], composer: '' };
  let providerSelected = [];
  try {
    const proof = await waitFor('three exact rendered proofs', async () => {
      const pilot = await pilotState();
      await resolvePendingNoResponse(pilot);
      const refreshed = evidence.noResponseResolution.completedAt ? await pilotState() : pilot;
      const selected = (refreshed?.ledger || []).filter(item => Object.values(questions).includes(item?.envelope?.text));
      const deliveryProofOk = selected.length === 3 && selected.every(item => item.state === 'proven');
      return { ok: deliveryProofOk, value: { pilot: refreshed, selected, deliveryProofOk } };
    }, 150000, 500);
    providerPilot = proof.value.pilot;
    providerSelected = proof.value.selected;
    providerReceiverState = await pageState('receiver');
    evidence.deliveryProofOk = proof.value.deliveryProofOk;
    evidence.providerCanary = { status: 'passed', reason: '', deliveryProofOk: true };
  } catch (error) {
    if (String(error?.message || error) !== 'Timed out: three exact rendered proofs') throw error;
    providerPilot = await pilotState();
    await resolvePendingNoResponse(providerPilot).catch(() => false);
    providerPilot = await pilotState();
    providerReceiverState = await pageState('receiver').catch(() => ({ users: [], assistants: [], composer: '' }));
    providerSelected = (providerPilot?.ledger || []).filter(item => Object.values(questions).includes(item?.envelope?.text));
    const latestFailure = [...providerSelected].reverse().find(item => item?.lastError)?.lastError
      || providerPilot?.latestProof?.reason
      || String(error?.message || error);
    evidence.deliveryProofOk = false;
    evidence.providerCanary = {
      status: 'limited',
      reason: String(latestFailure || 'provider_render_not_confirmed'),
      deliveryProofOk: false,
      diagnostic: { message: String(error?.message || error), lastSample: error?.last?.value || error?.last || null }
    };
    evidence.limitations.push(`Provider canary limited: ${evidence.providerCanary.reason}`);
  }

  evidence.finals = Object.entries(questions).map(([key, text]) => ({ key, text, proven: providerSelected.some(item => item.envelope?.text === text && item.state === 'proven') }));
  const pausedProofs = evidence.finals.filter(item => ['q2','q3'].includes(item.key));
  evidence.adaptiveTurnScenarios.pauseResume = {
    ...evidence.adaptiveTurnScenarios.pauseResume,
    provenFinals: pausedProofs.filter(item => item.proven).map(item => item.key)
  };
  evidence.adaptiveTurnScenariosOk = Object.values(evidence.adaptiveTurnScenarios).every(value => value?.ok === true);
  evidence.batches = { active: providerPilot?.batchState?.active || null, next: providerPilot?.batchState?.next || null, lastCompleted: providerPilot?.batchState?.lastCompleted || null, receiverUsers: providerReceiverState.users };
  evidence.ledger = providerSelected.map(item => ({ id: item.id, seq: item.envelope?.seq || 0, state: item.state, batchId: item.batchId || '', text: item.envelope?.text || '', lastError: item.lastError || '' }));
  evidence.outbox = { count: Number(providerPilot?.senderOutboxState?.count || 0), state: providerPilot?.senderOutboxState?.state || 'clear', restoredCount: Number(providerPilot?.senderOutboxState?.restoredCount || 0) };
  const gapEvent = [...(providerPilot?.timeline || [])].reverse().find(event => ['sequence_gap', 'sequence_gap_cleared'].includes(event?.type));
  evidence.gap = { clear: !gapEvent || gapEvent.type === 'sequence_gap_cleared', lastEvent: gapEvent?.type || 'none', data: gapEvent?.data || {} };
  if (evidence.providerCanary.status === 'passed' && (evidence.outbox.count !== 0 || !evidence.gap.clear)) {
    evidence.deliveryProofOk = false;
    evidence.providerCanary = {
      status: 'failed',
      reason: 'delivery_state_not_clear',
      deliveryProofOk: false
    };
  }
  if (!skipLiveAnswer && providerReceiverState.assistants.some(text => text.trim())) {
    evidence.answerCapability = { state: 'available', assistantCount: providerReceiverState.assistants.length };
  } else {
    evidence.answerCapability = { state: 'anonymous_answer_unavailable', assistantCount: providerReceiverState.assistants.length };
    evidence.limitations.push('The isolated anonymous provider session did not expose answer text.');
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
    const commandKey = item => String(item?.requestId || `${item?.command || ''}:${item?.startedAt || item?.completedAt || 0}`);
    const beforeCommandKeys = new Set((before?.commandJournal || []).map(commandKey));
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
    const concurrentCommands = (after?.commandJournal || [])
      .filter(item => !beforeCommandKeys.has(commandKey(item)))
      .map(item => ({ command:String(item?.command || ''), requestId:String(item?.requestId || ''), startedAt:Number(item?.startedAt || 0), completedAt:Number(item?.completedAt || 0) }));
    value.commandJournalDelta=concurrentCommands.length;
    value.concurrentCommands=concurrentCommands;
    value.localInteractionEvidence={ keyboardMoved:interaction.keyboardMoved, scenarioChanged:value.scenario==='network_loss', commandFreeSourceContract:operationsCommandIsolation.ok };
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
    && value.privacy==='safe' && value.keyboardMoved===true
    && value.localInteractionEvidence?.scenarioChanged===true
    && value.localInteractionEvidence?.commandFreeSourceContract===true
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

  const verification = deriveReleaseVerificationStatus({
    deterministic: {
      selfTest: evidence.selfTest?.ok === true,
      adaptiveTurnScenarios: evidence.adaptiveTurnScenariosOk,
      transportDrill: evidence.transportDrillOk,
      pilotUi: evidence.pilotUiOk,
      productionUi: evidence.productionUiOk,
      assistUi: evidence.assistUiOk,
      reliabilityUi: evidence.reliabilityUiOk,
      operationsUi: evidence.operationsUiOk
    },
    providerCanary: evidence.providerCanary
  });
  evidence.deterministicBrowser = verification.deterministicBrowser;
  evidence.releaseVerification = verification;
  evidence.ok = verification.packageReady;
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

console.log(JSON.stringify({ ok: evidence.ok, evidencePath, deliveryProofOk: evidence.deliveryProofOk, adaptiveTurnScenariosOk: evidence.adaptiveTurnScenariosOk, transportDrillOk: evidence.transportDrillOk, pilotUiOk: evidence.pilotUiOk, productionUiOk: evidence.productionUiOk, selfTest: evidence.selfTest?.ok === true, outbox: evidence.outbox, gap: evidence.gap, answerCapability: evidence.answerCapability, limitations: evidence.limitations }, null, 2));
if (failure || !evidence.ok) process.exit(1);