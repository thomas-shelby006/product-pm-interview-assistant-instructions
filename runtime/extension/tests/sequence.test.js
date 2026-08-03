import test from 'node:test';
import assert from 'node:assert/strict';
import { SequenceGate } from '../shared/sequence.js';

test('sequence gate accepts increasing values and rejects duplicate or stale delivery', () => {
  const gate = new SequenceGate();
  assert.deepEqual(gate.check(1), { accepted: true, reason: 'new', lastAcceptedSeq: 0 });
  gate.accept(1);
  assert.deepEqual(gate.check(1), { accepted: false, reason: 'duplicate', lastAcceptedSeq: 1 });
  assert.deepEqual(gate.check(0), { accepted: true, reason: 'unsequenced', lastAcceptedSeq: 1 });
  assert.deepEqual(gate.check(2), { accepted: true, reason: 'new', lastAcceptedSeq: 1 });
  gate.accept(2);
  assert.deepEqual(gate.check(1), { accepted: false, reason: 'stale', lastAcceptedSeq: 2 });
});

test('sequence gate restores its accepted value after receiver reload', () => {
  const gate = new SequenceGate(12);
  assert.equal(gate.lastAcceptedSeq, 12);
  assert.equal(gate.check(12).accepted, false);
  assert.equal(gate.check(13).accepted, true);
});

test('sequence gate can roll back a provisional receiver reservation', () => {
  const gate = new SequenceGate(12);
  const previous = gate.lastAcceptedSeq;
  gate.accept(13);
  assert.equal(gate.check(13).reason, 'duplicate');
  gate.restore(previous);
  assert.equal(gate.lastAcceptedSeq, 12);
  assert.equal(gate.check(13).accepted, true);
});

test('receiver admits a sequence only after the batch runtime accepts ownership', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const receive = entry.slice(
    entry.indexOf('async function receiveEnvelope'),
    entry.indexOf('async function handleRuntimeCommand')
  );
  const offerIndex = receive.indexOf('receiverSequenceBuffer.offer(envelope)');
  const drainIndex = receive.indexOf('await drainReceiverSequenceBuffer(envelope.id)');
  assert.ok(offerIndex >= 0 && offerIndex < drainIndex);
});


test('sequence admission distinguishes a retry from a stale envelope', () => {
  const gate = new SequenceGate(7);
  assert.deepEqual(gate.admit(7), {
    accepted: true,
    duplicate: true,
    reason: 'duplicate',
    seq: 7,
    previousAcceptedSeq: 7
  });
  assert.deepEqual(gate.admit(6), {
    accepted: false,
    duplicate: false,
    reason: 'stale',
    seq: 6,
    previousAcceptedSeq: 7
  });
  assert.deepEqual(gate.admit(8), {
    accepted: true,
    duplicate: false,
    reason: 'new',
    seq: 8,
    previousAcceptedSeq: 7
  });
});

test('receiver duplicate acknowledgement returns before batch admission', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const receive = entry.slice(
    entry.indexOf('async function receiveEnvelope'),
    entry.indexOf('async function handleRuntimeCommand')
  );
  const duplicateIndex = receive.indexOf('if (sequenceDecision.duplicate)');
  const drainIndex = receive.indexOf('await drainReceiverSequenceBuffer(envelope.id)');
  assert.ok(duplicateIndex >= 0 && duplicateIndex < drainIndex);
  assert.match(receive, /reason:\s*sequenceDecision\.reason/);
  assert.match(receive, /duplicate:\s*true/);
  assert.match(receive, /buffered:\s*Boolean\(sequenceDecision\.buffered\)/);
});


test('receiver admission marks forwarding pause as staging-only credit use', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const receive = source.slice(source.indexOf('async function receiveEnvelope'), source.indexOf('async function handleRuntimeCommand'));
  assert.match(receive, /stagingOnly:\s*envelope\?\.metadata\?\.coordinationMode === 'paused_stage'\s*\|\|\s*currentBatchState\?\.turnCoordination\?\.mode === 'paused_accumulating'/);
});


test('smoothed receiver credits preserve explicit staging-only input', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const helper = source.slice(source.indexOf('function deriveSmoothedReceiverCredits'), source.indexOf('function isCombinedVoiceActive'));
  assert.match(helper, /stagingOnly:\s*input\.stagingOnly/);
});
