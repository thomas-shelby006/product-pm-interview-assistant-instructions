import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
const markup = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');
const status = await readFile(new URL('../shared/session-status.js', import.meta.url), 'utf8');
const validator = await readFile(new URL('../scripts/validate-extension.mjs', import.meta.url), 'utf8');
const styles = await readFile(new URL('../dashboard/dashboard.css', import.meta.url), 'utf8');

test('dashboard ends cleanly without reconnecting or leaving controls active', () => {
  assert.match(dashboard, /state\.sessionEnded = true/);
  assert.match(dashboard, /if \(state\.sessionEnded\)[\s\S]*return;/);
  assert.match(dashboard, /Runtime controls are disabled/);
  assert.match(dashboard, /updateControlAvailability/);
});

test('destructive dashboard actions require explicit confirmation', () => {
  assert.match(markup, /id="discardSelected" data-confirm=/);
  assert.match(markup, /id="discardAll" data-confirm=/);
  assert.match(markup, /data-command="end_session" data-confirm=/);
});

test('dashboard tabs expose accessible selected and panel state', () => {
  assert.match(markup, /role="tablist"/);
  assert.match(markup, /role="tab" aria-selected="true"/);
  assert.match(markup, /role="tabpanel"/);
  assert.match(dashboard, /setAttribute\('aria-selected'/);
  assert.match(dashboard, /node\.hidden = !active/);
});

test('keyboard controls use normal command feedback and ignore repeats', () => {
  assert.match(dashboard, /function runKeyboardCommand/);
  assert.match(dashboard, /event\.repeat/);
  assert.match(dashboard, /commandResultLabel/);
});

test('active visible runtime surfaces contain no known mojibake sequences', () => {
  const combined = `${dashboard}
${markup}
${status}`;
  for (const codePoint of [0xFFFD, 0x00C2, 0x00E2]) {
    assert.equal(combined.includes(String.fromCodePoint(codePoint)), false);
  }
  assert.match(validator, /mojibakeMarkers/);
});
test('delivery success preserves the nullish fallback instead of arithmetic', () => {
  assert.match(dashboard, /deliverySuccessRate \?\? 100/);
  assert.doesNotMatch(dashboard, /deliverySuccessRate - 100/);
});

test('dashboard control grid remains bounded in the operational window', async () => {
  const css = await readFile(new URL('../dashboard/dashboard.css', import.meta.url), 'utf8');
  assert.match(css, /\.control-grid button \{[^}]*min-width: 0;[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/s);
  assert.match(css, /@media \(min-width: 720px\)[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(min-width: 1200px\)[\s\S]*repeat\(5, minmax\(0, 1fr\)\)/);
});


test('Pilot live view exposes lossless inbox current answer next draft and latency rail', () => {
  assert.match(markup, /id="catchUpState"/);
  assert.match(markup, /id="currentBatchTitle"/);
  assert.match(markup, /id="nextDraftText"/);
  assert.match(markup, /id="latencyRail"/);
  assert.match(markup, /Lossless inbox/);
  assert.match(styles, /\.live-command-center/);
  assert.match(styles, /\.latency-rail/);
});

test('Pilot live rendering is ledger and batch-state driven', () => {
  assert.match(dashboard, /deriveLiveInbox\(snapshot, now\)/);
  assert.match(dashboard, /snapshot\?\.ledger/);
  assert.match(dashboard, /snapshot\?\.batchState/);
  assert.match(dashboard, /storagePressure/);
});


test('Pilot exposes meaningful real-time inbox controls without removing legacy operations', () => {
  for (const id of ['autoSubmitAction', 'holdAction', 'submitNow', 'interruptLatest', 'copyLatest']) {
    assert.match(markup, new RegExp(`id="${id}"`));
  }
  assert.match(markup, /Resume &amp; catch up/);
  assert.match(markup, /Archive selected/);
  assert.match(dashboard, /set_auto_submit/);
  assert.match(dashboard, /interrupt_latest/);
  assert.match(dashboard, /navigator\.clipboard\.writeText\(latest\)/);
});

test('dangerous interrupt and archive controls require confirmation', () => {
  assert.match(markup, /id="interruptLatest"[^>]*data-confirm=/);
  assert.match(markup, /id="discardSelected"[^>]*data-confirm=/);
  assert.match(markup, /id="discardAll"[^>]*data-confirm=/);
});


test('Pilot exposes Pace Guard without adding provider focus operations', () => {
  for (const id of ['paceState', 'paceRates', 'paceForecast']) {
    assert.match(markup, new RegExp(`id="${id}"`));
  }
  assert.match(dashboard, /derivePaceGuard\(snapshot, now\)/);
  assert.match(styles, /\.pace-panel/);
  assert.doesNotMatch(dashboard, /chrome\.tabs\.update|chrome\.windows\.update|window\.focus\(/);
});
