import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../content/entry.js', import.meta.url), 'utf8');

test('successful receiver registration pulses the answer observer deadline', () => {
  const registration = source.slice(
    source.indexOf('async function register()'),
    source.indexOf('async function forwardPreview')
  );
  assert.match(registration, /rolePort\?\.connect\(\);\s*if \(runtimeConfig\.role === 'receiver'\) answerWake\.pulse\(\);/);
  assert.match(registration, /setInterval\(\(\) => \{\s*if \(registrationActive\) register\(\);/);
});

test('receiver link-status updates pulse the answer observer before UI work', () => {
  const linkStatus = source.slice(
    source.indexOf("incoming?.type === 'PMIA_LINK_STATUS'"),
    source.indexOf("incoming?.type === 'PMIA_ROLE_REVOKED'")
  );
  const pulseAt = linkStatus.indexOf("if (runtimeConfig.role === 'receiver') answerWake.pulse();");
  const overlayAt = linkStatus.indexOf('overlay.setStatus');
  assert.ok(pulseAt >= 0);
  assert.ok(overlayAt > pulseAt);
});
