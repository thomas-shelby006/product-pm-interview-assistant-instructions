import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const repo = new URL('../../../', import.meta.url);
const pkg = JSON.parse(fs.readFileSync(new URL('package.json', repo), 'utf8'));
const gate = fs.readFileSync(new URL('runtime/Validate_Extension_Runtime.ps1', repo), 'utf8');
const validator = fs.readFileSync(new URL('runtime/extension/scripts/validate-extension.mjs', repo), 'utf8');

test('default repository test command targets active 0.12 tests only', () => {
  assert.equal(pkg.scripts.test, 'node --test --test-concurrency=1 runtime/extension/tests/simple-*.test.js');
});

test('release gate validates only the active extension and optional AHK bootstrap', () => {
  assert.match(gate, /npm test/);
  assert.match(gate, /npm run validate/);
  assert.match(gate, /Final_2_Window_Extension\.ahk/);
  assert.match(gate, /run-simple-isolated-smoke\.mjs/);
  assert.match(gate, /run-simple-provider-fixture-smoke\.mjs/);
  assert.doesNotMatch(gate, /Session_Tracker_End_Session|PMIA_Runtime_Platform_Smoke|requiredHotkeys|Runtime Pilot/i);
});

test('extension validator rejects legacy active imports instead of requiring old dashboard surfaces', () => {
  assert.match(validator, /simple\/service-worker\.js/);
  assert.match(validator, /studio\/index\.html/);
  assert.match(validator, /cockpit\/index\.html/);
  assert.doesNotMatch(validator, /contiguous-sequence-buffer|runtime-recovery-coordinator|runtime-pilot-controller/);
});
