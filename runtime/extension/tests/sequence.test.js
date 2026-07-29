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

test('receiver reserves and persists a sequence before provider submission', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const receive = entry.slice(
    entry.indexOf('async function receiveEnvelope'),
    entry.indexOf('chrome.runtime.onMessage.addListener')
  );
  const reserveIndex = receive.indexOf('receiverSequenceGate.accept(envelope.seq)');
  const persistIndex = receive.indexOf('sessionStorage.setItem');
  const deliverIndex = receive.indexOf('await receiver.deliver(envelope)');
  assert.ok(reserveIndex >= 0 && reserveIndex < deliverIndex);
  assert.ok(persistIndex >= 0 && persistIndex < deliverIndex);
  assert.match(receive, /if \(!submitted\) \{[\s\S]*receiverSequenceGate\.restore\(previousAcceptedSeq\)/);
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

test('receiver retry acknowledgement is explicit and never calls provider delivery twice', async () => {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const entry = await readFile(resolve(extensionRoot, 'content/entry.js'), 'utf8');
  const receive = entry.slice(
    entry.indexOf('async function receiveEnvelope'),
    entry.indexOf('chrome.runtime.onMessage.addListener')
  );
  assert.match(receive, /receiverSequenceGate\.admit\(envelope\?\.seq\)/);
  assert.match(receive, /if \(sequenceDecision\.duplicate\)[\s\S]*reason:\s*'duplicate_ack'/);
  assert.match(receive, /duplicate_ack[\s\S]*return[\s\S]*await receiver\.deliver\(envelope\)/);
});
