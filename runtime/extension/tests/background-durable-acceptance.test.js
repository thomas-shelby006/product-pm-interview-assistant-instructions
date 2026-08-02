import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../background.js', import.meta.url), 'utf8');

function sliceBetween(start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

test('non-boot forwarding acknowledges durable ownership before receiver delivery', () => {
  const block = sliceBetween('async function handleForward', 'function authorizeSessionMessage');
  const scheduleAt = block.indexOf('schedulePersistedDelivery(message.envelope)');
  const responseAt = block.indexOf("reason: 'delivery_scheduled'");
  assert.ok(scheduleAt >= 0);
  assert.ok(responseAt > scheduleAt);
  assert.match(block, /persisted:\s*true/);
  assert.match(block, /queued:\s*true/);
});

test('persisted delivery uses a separate ordered lane from durable acceptance', () => {
  const block = sliceBetween('function schedulePersistedDelivery', 'async function handleForward');
  assert.match(block, /void deliveryCoordinator\.run\(/);
  assert.match(block, /completePersistedDelivery\(envelope\)/);
  assert.match(block, /envelope\.sessionId/);
});

test('delivery exceptions retain unresolved ownership for recovery', () => {
  const block = sliceBetween('async function completePersistedDelivery', 'function schedulePersistedDelivery');
  assert.match(block, /reason:\s*'delivery_exception'/);
  assert.match(block, /queued:\s*true/);
  assert.match(block, /pilotController\.afterForward\(envelope, outcome\)/);
});

test('boot delivery remains synchronous while normal finals are deferred', () => {
  const block = sliceBetween('async function handleForward', 'function authorizeSessionMessage');
  assert.match(block, /if \(message\.envelope\.kind !== 'boot'\)/);
  assert.match(block, /const outcome = await completePersistedDelivery\(message\.envelope\)/);
});
