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

test('entry runtime preserves sender candidate source through forwarding', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  assert.match(entry, /adapter\.getSenderCandidateInfo\(\)/);
  assert.match(entry, /forwarder\.pollCandidate\(/);
  assert.doesNotMatch(entry, /forwarder\.consider\(adapter\.getSenderCandidate\(\), now\)/);
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
  assert.match(entry, /forwarder\.pendingDelay/);
  assert.match(entry, /senderObserver\.disconnect/);
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
  assert.doesNotMatch(entry, /â€”/);
});

test('entry runtime primes historical sender turns before observation starts', async () => {
  const { readFile } = await import('node:fs/promises');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const primeIndex = entry.indexOf('primeHistoricalCandidate(');
  const observerIndex = entry.indexOf('createProviderObserver({');
  assert.ok(primeIndex >= 0);
  assert.ok(observerIndex > primeIndex);
  assert.match(entry, /adapter\.getSenderCandidateInfo\(\)/);
});