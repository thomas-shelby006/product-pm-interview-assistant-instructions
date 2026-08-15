import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../content/entry.js', import.meta.url), 'utf8');

test('successful answer-role registration pulses the answer observer deadline', () => {
  const registration = source.slice(
    source.indexOf('async function register()'),
    source.indexOf('async function forwardPreview')
  );
  assert.match(registration, /rolePort\?\.connect\(\);\s*if \(isAnswerRole\) \{\s*answerWake\.pulse\(\);\s*deliveryWake\.pulse\(\);\s*\}/);
  assert.match(registration, /setInterval\(\(\) => \{\s*if \(registrationActive\) register\(\);/);
});

test('answer-role link-status updates pulse the answer observer before UI work', () => {
  const linkStatus = source.slice(
    source.indexOf("incoming?.type === 'PMIA_LINK_STATUS'"),
    source.indexOf("incoming?.type === 'PMIA_EXPORT_SESSION'")
  );
  const pulseAt = linkStatus.indexOf('answerWake.pulse();');
  const deliveryAt = linkStatus.indexOf('deliveryWake.pulse();');
  const overlayAt = linkStatus.indexOf('overlay.setStatus');
  assert.ok(pulseAt >= 0);
  assert.ok(deliveryAt > pulseAt);
  assert.ok(overlayAt > deliveryAt);
});
