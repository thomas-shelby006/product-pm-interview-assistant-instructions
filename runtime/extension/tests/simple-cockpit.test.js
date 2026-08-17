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

test('Tools and Help keeps secondary features out of the dock', () => {
  const html = read('index.html');
  for (const id of ['sessionClock','focusSender','focusReceiver','focusComparison','restoreLayout','reviewRefresh','recentQuestions','fontSize','highContrast','reducedMotion','endSession']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Tools & Help/i);
  assert.match(html, /Review/i);
  assert.match(html, /End session/i);
});

test('cockpit uses explicit UI commands for window tools review markers and end', () => {
  const js = read('cockpit.js');
  for (const token of ['focus_window','restore_layout','get_review_data','mark_question','get_end_state','end_session']) {
    assert.match(js, new RegExp(token));
  }
  assert.match(js, /setInterval/);
  assert.doesNotMatch(js, /chrome\.alarms/);
});

test('cockpit has exactly one controller entry point', () => {
  const html = read('index.html');
  assert.equal((html.match(/<script type="module" src="cockpit\.js"><\/script>/g) || []).length, 1);
  assert.doesNotMatch(html, /runtime\.js/);
});
test('cockpit reconnects its UI port after MV3 worker suspension without a heartbeat', () => {
  const js = read('cockpit.js');
  assert.match(js, /createResilientPort/);
  assert.match(js, /onReconnect[\s\S]*ui_register[\s\S]*get_snapshot/);
  assert.doesNotMatch(js, /setInterval\([^,]+,\s*2[0-9]000|heartbeat/i);
});