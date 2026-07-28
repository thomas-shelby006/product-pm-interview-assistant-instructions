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
  assert.match(entry, /receiverSequenceGate\.check/);
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
  assert.doesNotMatch(entry, /ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/);
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
