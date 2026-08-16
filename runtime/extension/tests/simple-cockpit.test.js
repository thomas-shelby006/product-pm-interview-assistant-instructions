import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../cockpit/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');

test('cockpit is a compact five-control dock', () => {
  const html = read('index.html');
  for (const id of ['autoForward','pause','sendGathered','export','help']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /Window 1/i);
  assert.match(html, /Window 2/i);
  assert.match(html, /Window 3/i);
  assert.doesNotMatch(html, /Runtime Pilot|Recovery Console|Transport Drill|Session Navigator/i);
});

test('cockpit renders stable stage path and contains no resync loop copy', () => {
  const js = read('cockpit.js');
  assert.match(js, /captured/);
  assert.match(js, /composer_written/);
  assert.match(js, /submitted/);
  assert.match(js, /rendered/);
  assert.doesNotMatch(js, /resyncing/i);
});

test('cockpit controls route through the simple extension control channel', () => {
  const js = read('cockpit.js');
  assert.match(js, /set_auto_forward/);
  assert.match(js, /set_paused/);
  assert.match(js, /send_gathered/);
  assert.match(js, /get_snapshot/);
});

test('cockpit export adds derived session summary without changing the hot path', () => {
  const js = read('cockpit.js');
  assert.match(js, /buildSessionSummary/);
  assert.match(js, /summary:/);
  assert.match(js, /trace:snapshot/);
});

test('cockpit exposes lightweight keyboard shortcuts in Help', () => {
  const html = read('index.html');
  const js = read('cockpit.js');
  for (const key of ['A','P','G','E','H']) assert.match(html, new RegExp(`<kbd>${key}<\\/kbd>`));
  assert.match(js, /keydown/);
});
