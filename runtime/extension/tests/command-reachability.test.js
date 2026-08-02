import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditCommandReachability } from '../shared/command-reachability-audit.js';

const html = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
const controller = await readFile(new URL('../shared/runtime-pilot-controller.js', import.meta.url), 'utf8');

test('every visible PMIA command is registered and controller-owned', () => {
  const audit = auditCommandReachability({ html, dashboardSource:dashboard, controllerSource:controller });
  assert.equal(audit.ok, true, JSON.stringify(audit.errors));
  assert.deepEqual(audit.visibleWithoutRegistry, []);
  assert.deepEqual(audit.visibleWithoutOwner, []);
});

test('dashboard IDs are unique', () => {
  const audit = auditCommandReachability({ html, dashboardSource:dashboard, controllerSource:controller });
  assert.deepEqual(audit.duplicateDomIds, []);
});

test('reachability audit reports detached controls deterministically', () => {
  const audit = auditCommandReachability({
    registry:[{ id:'known' }], html:'<button id="x" data-command="known"></button><button id="x" data-command="missing"></button>',
    dashboardSource:'', controllerSource:"case 'known': break;"
  });
  assert.equal(audit.ok, false);
  assert.deepEqual(audit.duplicateDomIds, ['x']);
  assert.deepEqual(audit.visibleWithoutRegistry, ['missing']);
  assert.deepEqual(audit.visibleWithoutOwner, ['missing']);
});