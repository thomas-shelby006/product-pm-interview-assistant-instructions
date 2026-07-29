import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

test('extension validator does not flag its own forbidden marker definitions', () => {
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = spawnSync(process.execPath, [resolve(extensionRoot, 'scripts/validate-extension.mjs')], {
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Extension validation passed/);
});

test('entry runtime routes ordered turns through provider-specific sender control', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const sender = await readFile(resolve(extensionRoot, 'content/senders/provider-sender.js'), 'utf8');
  assert.match(entry, /createProviderSender/);
  assert.match(sender, /getConversationMessages/);
  assert.match(entry, /onChange:/);
  assert.doesNotMatch(entry, /new StableTranscriptForwarder/);
  assert.doesNotMatch(entry, /considerSenderCandidate/);
});


test('entry runtime subscribes to Claude voice lifecycle signals', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  assert.match(entry, /createClaudeSignalBridge/);
  assert.match(entry, /createClaudeSignalHandler/);
  assert.match(entry, /assistantFinalHintVersion/);
  assert.match(entry, /providerSignalBridge\.disconnect/);
});

test('entry runtime uses scoped observation instead of hot sender polling', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  assert.match(entry, /createProviderObserver/);
  assert.match(entry, /createProviderSender/);
  assert.match(entry, /senderObserver\.disconnect/);
  assert.match(entry, /watchdogMs: 500/);
  assert.doesNotMatch(entry, /const POLL_MS = 180/);
  assert.doesNotMatch(entry, /senderTimer = setInterval/);
});

test('runtime applies sender and receiver sequence idempotency', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const background = await readFile(resolve(extensionRoot, 'background.js'), 'utf8');
  assert.match(entry, /nextSequence/);
  assert.match(entry, /new SequenceGate/);
  assert.match(entry, /seq: nextSenderSequence/);
  assert.match(entry, /receiverSequenceGate\.admit/);
  assert.match(entry, /receiverSequenceGate\.accept/);
  assert.match(background, /registry\.acceptSequence/);
  assert.match(background, /stale_sequence|duplicate_sequence/);
});

test('runtime stores and exports logs per managed window role', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const background = await readFile(resolve(extensionRoot, 'background.js'), 'utf8');
  assert.match(background, /roleLogKey/);
  assert.match(background, /registry\.roleForTab/);
  assert.match(background, /appendBoundedLog/);
  assert.match(entry, /buildSessionExport/);
  assert.match(entry, /renderSessionMarkdown/);
  assert.match(entry, /role: runtimeConfig\.role/);
  assert.doesNotMatch(entry, /ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â/);
});

test('entry runtime primes historical sender turns before observation starts', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const primeIndex = entry.indexOf('createProviderSender({');
  const observerIndex = entry.indexOf('createProviderObserver({');
  assert.ok(primeIndex >= 0);
  assert.ok(observerIndex > primeIndex);
  const sender = await readFile(resolve(extensionRoot, 'content/senders/provider-sender.js'), 'utf8');
  assert.match(sender, /tracker\.prime\(adapter\.getConversationMessages/);
});
test('background exposes a direct ephemeral preview lane beside durable finals', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const background = await readFile(resolve(extensionRoot, 'background.js'), 'utf8');
  const preview = await readFile(resolve(extensionRoot, 'shared/preview.js'), 'utf8');
  assert.match(background, /deliverPreview/);
  assert.match(background, /message\?\.type === 'PMIA_PREVIEW'/);
  assert.match(preview, /PMIA_PREVIEW_DELIVER/);
  const previewBranch = background.slice(
    background.indexOf("message?.type === 'PMIA_PREVIEW'"),
    background.indexOf("message?.type === 'PMIA_FORWARD'")
  );
  assert.doesNotMatch(previewBranch, /queueLatest|appendLog|acceptSequence|saveRegistry/);
});


test('entry runtime wires provider previews to receiver prefill without final sequencing', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  assert.match(entry, /makePreview/);
  assert.match(entry, /PMIA_PREVIEW/);
  assert.match(entry, /onPreview/);
  assert.match(entry, /forwardPreview/);
  assert.match(entry, /PMIA_PREVIEW_DELIVER/);
  assert.match(entry, /receiver\.preview/);
  const previewFunction = entry.slice(
    entry.indexOf('async function forwardPreview'),
    entry.indexOf('async function forwardText')
  );
  assert.match(previewFunction, /nextSequence/);
  assert.doesNotMatch(previewFunction, /senderSequence|makeEnvelope|PMIA_LOG_EVENT/);
});

test('entry runtime captures answers from provider mutations with a 500ms watchdog', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  assert.match(entry, /createAnswerTracker/);
  assert.match(entry, /createWakeSignal/);
  assert.match(entry, /receiverObserver/);
  assert.match(entry, /answerWake\.pulse/);
  assert.match(entry, /await answerWake\.wait\(500\)/);
  const capture = entry.slice(
    entry.indexOf('async function captureAnswer'),
    entry.indexOf('const receiver = createReceiverController')
  );
  assert.doesNotMatch(capture, /sleep\(300\)/);
  assert.doesNotMatch(capture, /stableSince >= 850/);
});

test('background keeps preview delivery outside durable serialization and storage reads', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const background = await readFile(resolve(extensionRoot, 'background.js'), 'utf8');
  assert.match(background, /let registryPromise = null/);
  assert.match(background, /if \(!registryPromise\)/);
  const listener = background.slice(background.indexOf('chrome.runtime.onMessage.addListener'));
  const previewIndex = listener.indexOf("message?.type === 'PMIA_PREVIEW'");
  const serializedIndex = listener.indexOf('serialize(async () =>');
  assert.ok(previewIndex >= 0 && previewIndex < serializedIndex);
  const fastPath = listener.slice(previewIndex, serializedIndex);
  assert.match(fastPath, /deliverPreview/);
  assert.doesNotMatch(fastPath, /saveRegistry|appendLog|queueLatest|acceptSequence/);
});

test('preview ordering is page-lifetime memory and never writes browser storage', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  assert.match(entry, /createLatestPreviewScheduler/);
  assert.doesNotMatch(entry, /previewSequenceKey/);
  const previewFunction = entry.slice(
    entry.indexOf('async function forwardPreview'),
    entry.indexOf('async function forwardText')
  );
  assert.doesNotMatch(previewFunction, /sessionStorage\.setItem/);
});

test('receiver submits before starting durable received-text telemetry', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const receive = entry.slice(
    entry.indexOf('async function receiveEnvelope'),
    entry.indexOf('chrome.runtime.onMessage.addListener')
  );
  const deliverIndex = receive.indexOf('await receiver.deliver(envelope)');
  const logIndex = receive.indexOf("logEvent('received_text'");
  assert.ok(deliverIndex >= 0, 'receiver delivery must exist');
  assert.ok(logIndex > deliverIndex, 'received-text logging must start after submission');
  assert.match(receive, /deliveryElapsedMs/);
});

test('entry runtime uses readiness submission and event-driven recovery without fixed hotkey delays', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  assert.match(entry, /createRuntimeRecovery/);
  assert.match(entry, /submitComposerWhenReady/);
  assert.doesNotMatch(entry, /await sleep\(60\)/);
  const copyHandler = entry.slice(entry.indexOf("document.addEventListener('copy'"), entry.indexOf('function download'));
  assert.doesNotMatch(copyHandler, /setTimeout/);
});
test('runtime exposes an authorized F11 preflight status check', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const background = await readFile(resolve(extensionRoot, 'background.js'), 'utf8');
  assert.match(entry, /key === 'F11'/);
  assert.match(entry, /PMIA_RUN_PREFLIGHT/);
  assert.match(background, /PMIA_RUN_PREFLIGHT/);
  assert.match(background, /runCounterpartPreflight/);
});
test('entry preserves runtime resources for back-forward cache restoration', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const pagehide = entry.slice(entry.indexOf("window.addEventListener('pagehide'"));
  assert.match(pagehide, /event\.persisted/);
  assert.match(pagehide, /if \(event\.persisted\) return/);
});
test('receiver acknowledgement never waits for telemetry after successful submission', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const receive = entry.slice(
    entry.indexOf('async function receiveEnvelope'),
    entry.indexOf('chrome.runtime.onMessage.addListener')
  );
  assert.match(receive, /void logEvent\('received_text'/);
  assert.doesNotMatch(receive, /await receivedLog/);
  assert.doesNotMatch(receive, /const receivedLog/);
});
test('entry imports every runtime dependency passed to the receiver controller', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const runtimeImport = entry.match(
    /import\s*\{([\s\S]*?)\}\s*from '\.\/runtime\.js';/
  )?.[1] || '';
  const receiverCall = entry.slice(
    entry.indexOf('const receiver = createReceiverController'),
    entry.indexOf("if (runtimeConfig.role === 'receiver')")
  );
  assert.match(receiverCall, /\bsleep\b/);
  assert.match(runtimeImport, /\bsleep\b/);
});
test('content startup renders fatal diagnostics for import and runtime failures', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const main = await readFile(resolve(extensionRoot, 'content/main.js'), 'utf8');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  assert.match(main, /runtime-fatal\.js/);
  assert.match(main, /renderRuntimeFatal/);
  assert.match(main, /stage:\s*'load'/);
  assert.match(entry, /renderRuntimeFatal/);
  assert.match(entry, /stage:\s*'start'/);
  assert.match(entry, /chrome\.runtime\.getManifest\(\)\.version/);
});
test('runtime uses an active counterpart preflight and automatic link status', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const background = await readFile(resolve(extensionRoot, 'background.js'), 'utf8');
  assert.match(background, /runCounterpartPreflight/);
  assert.match(background, /PMIA_RUN_PREFLIGHT/);
  assert.match(background, /PMIA_LINK_STATUS/);
  assert.match(entry, /createPreflightResponder/);
  assert.match(entry, /PMIA_PREFLIGHT_PING/);
  assert.match(entry, /PMIA_LINK_STATUS/);
  const f11 = entry.slice(entry.indexOf("if (key === 'F11')"), entry.indexOf("if (key === 'F12'"));
  assert.match(f11, /PMIA_RUN_PREFLIGHT/);
  assert.match(f11, /response\.counterpart/);
  assert.doesNotMatch(f11, /PMIA_GET_STATUS/);
});

test('background broadcasts link status after a managed tab closes', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const background = await readFile(resolve(extensionRoot, 'background.js'), 'utf8');
  const removed = background.slice(background.indexOf('chrome.tabs.onRemoved.addListener'));
  assert.match(removed, /affectedSessionIds/);
  assert.match(removed, /registry\.unregister\(tabId\)/);
  assert.match(removed, /broadcastLinkStatus/);
});
test('an invalidated extension context becomes a stable reload state', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const messageBlock = entry.slice(
    entry.indexOf('const message = async payload'),
    entry.indexOf('const logEvent = async')
  );
  assert.match(messageBlock, /invalidated \? 0 : 3500/);
  assert.match(messageBlock, /RELOAD TAB/);
});

test('runtime fallback diagnostics contain no replacement-character mojibake', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const main = await readFile(resolve(extensionRoot, 'content/main.js'), 'utf8');
  assert.doesNotMatch(main, /\uFFFD|A�|Ã|â€™|â€“/);
});


test('entry promotes lifecycle title only after registration and composer readiness', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../content/entry.js', import.meta.url), 'utf8');
  assert.match(source, /runtimeLifecycleTitle/);
  assert.match(source, /setTarget\(runtimeLifecycleTitle\(runtimeConfig, 'registered'\)\)/);
  assert.match(source, /adapter\.findComposer\(\)/);
  assert.match(source, /setTarget\(runtimeLifecycleTitle\(runtimeConfig, 'ready'\)\)/);
});

test('background preserves sleeping registrations and protects managed tabs from discard', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const background = await readFile(resolve(extensionRoot, 'background.js'), 'utf8');
  const loadBlock = background.slice(
    background.indexOf('async function loadRegistry()'),
    background.indexOf('async function saveRegistry')
  );
  assert.doesNotMatch(loadBlock, /pruneStale/);
  const registrationBlock = background.slice(
    background.indexOf('async function handleRegistration'),
    background.indexOf('async function handleForward')
  );
  assert.match(registrationBlock, /autoDiscardable:\s*false/);
  assert.match(background, /chrome\.tabs\.onUpdated\.addListener/);
  assert.match(background, /PMIA_RUNTIME_RESUME/);
});

test('content runtime accepts a managed-tab restore signal', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const listener = entry.slice(entry.indexOf('chrome.runtime.onMessage.addListener'));
  assert.match(listener, /PMIA_RUNTIME_RESUME/);
  assert.match(listener, /runtimeRecovery\?\.trigger\('tab_restored'\)/);
});

test('transient delivery errors preserve the registered receiver for wake recovery', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const background = await readFile(resolve(extensionRoot, 'background.js'), 'utf8');
  const deliver = background.slice(
    background.indexOf('async function deliver('),
    background.indexOf('async function handleRegistration')
  );
  assert.ok(!deliver.includes('registry.unregister(route.tabId)'));
  assert.ok(deliver.includes('registry.queueLatest(route.message.sessionId, route.message)'));
});

test('sender boot shortcut forwards context without submitting into the question source', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = await readFile(resolve(extensionRoot, 'content', 'entry.js'), 'utf8');
  const block = source.slice(source.indexOf("if (key === 'F5'"), source.indexOf("if (key === 'F6'"));
  assert.match(block, /forwardText\(text, 'boot'/);
  assert.doesNotMatch(block, /submitComposerWhenReady/);
});

test('content runtime exposes an exact managed-session end command', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  assert.match(source, /key === 'F4'/);
  assert.match(source, /type: 'PMIA_END_SESSION'/);
  const background = await readFile(resolve(extensionRoot, 'background.js'), 'utf8');
  assert.match(background, /message\?\.type === 'PMIA_END_SESSION'/);
  assert.match(background, /closeOwnedSessionTabs/);
});
