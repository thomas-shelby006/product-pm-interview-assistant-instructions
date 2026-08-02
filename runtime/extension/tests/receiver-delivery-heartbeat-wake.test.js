import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../content/entry.js', import.meta.url), 'utf8');

test('receiver delivery confirmation owns a wake channel separate from answer observation', () => {
  assert.match(source, /const answerWake = createWakeSignal\(\);\s*const deliveryWake = createWakeSignal\(\);/);
  const receiver = source.slice(
    source.indexOf('const receiver = createReceiverController'),
    source.indexOf("if (runtimeConfig.role === 'receiver') {", source.indexOf('const receiver = createReceiverController'))
  );
  assert.match(receiver, /yieldFn:\s*\(\) => deliveryWake\.wait\(500\)/);
});

test('existing lifecycle and provider signals wake both receiver deadline owners', () => {
  const registration = source.slice(source.indexOf('async function register()'), source.indexOf('async function forwardPreview'));
  assert.match(registration, /answerWake\.pulse\(\);\s*deliveryWake\.pulse\(\);/);

  const provider = source.slice(source.indexOf('receiverObserver = createProviderObserver'), source.indexOf('function persistReceiverSequenceBuffer'));
  assert.match(provider, /answerWake\.pulse\(\);\s*deliveryWake\.pulse\(\);/);

  const linkStatus = source.slice(source.indexOf("incoming?.type === 'PMIA_LINK_STATUS'"), source.indexOf("incoming?.type === 'PMIA_EXPORT_SESSION'"));
  assert.match(linkStatus, /answerWake\.pulse\(\);\s*deliveryWake\.pulse\(\);/);
});

test('receiver delivery wake is pulsed on restore and disconnected during teardown', () => {
  const resume = source.slice(source.indexOf("incoming?.type === 'PMIA_RUNTIME_RESUME'"), source.indexOf("incoming?.type === 'PMIA_RUNTIME_COMMAND'"));
  assert.match(resume, /deliveryWake\.pulse\(\)/);
  const dispose = source.slice(source.indexOf('const disposeRuntime'), source.indexOf("window.addEventListener('pagehide'"));
  assert.match(dispose, /answerWake\.disconnect\(\);\s*deliveryWake\.disconnect\(\);/);
});
