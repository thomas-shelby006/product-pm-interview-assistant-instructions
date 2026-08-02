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


test('direct and fallback final acceptance share a dedicated session lane', () => {
  assert.match(source, /const acceptanceCoordinator = createSessionMutationCoordinator\(\)/);
  assert.match(source, /acceptanceCoordinator\.run\(frame\.identity\.sessionId/);
  assert.match(source, /acceptanceCoordinator\.run\(message\.envelope\?\.sessionId/);
});

test('generic session operations do not own PMIA_FORWARD persistence', () => {
  const generic = sliceBetween("serialize(async () => {\n    const registry = await loadRegistry();", 'chrome.runtime.onConnect');
  assert.doesNotMatch(generic, /message\?\.type === 'PMIA_FORWARD'/);
});


test('durable acceptance creates a one-shot delivery wake before acknowledging', () => {
  const block = sliceBetween('async function schedulePersistedDelivery', 'async function handleForward');
  assert.match(block, /await chrome\.alarms\.create\(deliveryAlarmName\(envelope\.sessionId\)/);
  assert.match(block, /when: Date\.now\(\) \+ 250/);
  assert.match(block, /deliveryCoordinator\.run/);
});

test('delivery alarm reconciles unresolved ledger ownership after worker suspension', () => {
  const block = sliceBetween('chrome.alarms.onAlarm.addListener', 'void rehydrateManagedAlarms');
  assert.match(block, /\^pmia-delivery:/);
  assert.match(block, /pilotController\.reconcileSession\(sessionId\)/);
  assert.match(block, /pilotController\.auditConsistency/);
});

test('successful receiver ownership clears the one-shot delivery alarm', () => {
  const block = sliceBetween('async function completePersistedDelivery', 'async function schedulePersistedDelivery');
  assert.match(block, /chrome\.alarms\.clear\(deliveryAlarmName\(envelope\.sessionId\)\)/);
});
