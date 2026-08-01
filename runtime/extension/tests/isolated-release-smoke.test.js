import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const powershell = await readFile(new URL('../../scripts/run-isolated-release-smoke.ps1', import.meta.url), 'utf8');
const runner = await readFile(new URL('../../scripts/isolated-release-smoke.mjs', import.meta.url), 'utf8');
const validator = await readFile(new URL('../../Validate_Extension_Runtime.ps1', import.meta.url), 'utf8');

test('isolated smoke owns a temporary profile and exact Edge process tree', () => {
  assert.match(powershell, /--user-data-dir=/);
  assert.match(powershell, /--disable-extensions-except=/);
  assert.match(powershell, /--load-extension=/);
  assert.match(powershell, /remote-debugging-port/);
  assert.match(powershell, /finally/);
  assert.match(powershell, /taskkill[\s\S]*\/T[\s\S]*\/F/i);
  assert.match(powershell, /Remove-Item[\s\S]*profile/i);
  assert.doesNotMatch(powershell, /Edge\\User Data\\Default|--profile-directory=Default/);
});

test('isolated smoke uses fixed synthetic questions and exact proof checks', () => {
  assert.match(runner, /Synthetic PMIA release Q1/);
  assert.match(runner, /Synthetic PMIA release Q2/);
  assert.match(runner, /Synthetic PMIA release Q3/);
  assert.match(runner, /every\(item => item\.state === 'proven'\)/);
  assert.match(runner, /senderOutboxState/);
  assert.match(runner, /sequence_gap/);
  assert.doesNotMatch(runner, /resume|job description|clipboard\.readText/i);
});

test('isolated smoke writes structured evidence and distinguishes answer limitations', () => {
  for (const key of ['isolatedProfile', 'extensions', 'selfTest', 'finals', 'batches', 'ledger', 'outbox', 'gap', 'answerCapability', 'cleanup', 'limitations']) {
    assert.match(runner, new RegExp(`${key}:`));
  }
  assert.match(runner, /anonymous_answer_unavailable/);
  assert.match(runner, /deliveryProofOk/);
});

test('complete validator requires the repository-owned smoke surfaces', () => {
  assert.match(validator, /run-isolated-release-smoke\.ps1/);
  assert.match(validator, /isolated-release-smoke\.mjs/);
});