import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const exists = path => fs.existsSync(new URL(path, root));

test('0.12 tree contains no retired 0.11 runtime directories or background owner', () => {
  for (const path of ['background.js','content/','dashboard/','shared/']) {
    assert.equal(exists(path), false, `${path} must be removed from the 0.12 branch`);
  }
});

test('0.12 test directory contains only simple runtime contracts', () => {
  const names = fs.readdirSync(new URL('tests/', root)).filter(name => name.endsWith('.test.js'));
  assert.ok(names.length > 10);
  assert.equal(names.every(name => name.startsWith('simple-')), true, names.filter(name => !name.startsWith('simple-')).join(', '));
});

test('0.12 testing fixtures contain only simple transport smoke surfaces', () => {
  const names = fs.readdirSync(new URL('testing/', root)).sort();
  assert.deepEqual(names, ['simple-transport-smoke.html','simple-transport-smoke.js']);
});

test('0.12 Windows runtime has no retired platform or review AHK owners', () => {
  const runtime = new URL('../../', import.meta.url);
  for (const name of ['PMIA_Runtime_Platform.ahk','PMIA_Runtime_Platform_Smoke.ahk','Session_Tracker_End_Session.ahk']) {
    assert.equal(fs.existsSync(new URL(name, runtime)), false, `${name} must be removed`);
  }
});

test('0.12 runtime scripts contain only the two active isolated smoke runners', () => {
  const scripts = new URL('../../scripts/', import.meta.url);
  const names = fs.readdirSync(scripts).sort();
  assert.deepEqual(names, ['run-simple-isolated-smoke.mjs','run-simple-provider-fixture-smoke.mjs']);
});
