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
  assert.match(markup, /id="archiveSelected" data-confirm=/);
  assert.match(markup, /id="archiveAll" data-confirm=/);
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
  assert.match(markup, /id="archiveSelected"[^>]*data-confirm=/);
  assert.match(markup, /id="archiveAll"[^>]*data-confirm=/);
});


test('Pilot exposes Pace Guard without adding provider focus operations', () => {
  for (const id of ['paceState', 'paceRates', 'paceForecast']) {
    assert.match(markup, new RegExp(`id="${id}"`));
  }
  assert.match(dashboard, /derivePaceGuard\(snapshot, now\)/);
  assert.match(styles, /\.pace-panel/);
  assert.doesNotMatch(dashboard, /chrome\.tabs\.update|chrome\.windows\.update|window\.focus\(/);
});


test('Pilot groups health markers into operational diagnostic categories', () => {
  assert.match(markup, /id="diagnosticGroups"/);
  assert.match(markup, /Diagnostic categories/);
});


test('Pilot exposes an operation guard for in-flight commands', () => {
  assert.match(markup, /id="operationGuard"/);
  assert.match(markup, /id="operationActivity">Idle/);
});


test('Pilot exposes Gap Watch for protected out-of-order finals', () => {
  assert.match(markup, /class="live-panel gap-panel"/);
  assert.match(markup, /id="gapState"/);
  assert.match(markup, /id="gapDetail"/);
});


test('Pilot exposes sender outbox status and a safe retry control', () => {
  assert.match(markup, /class="live-panel outbox-panel"/);
  assert.match(markup, /data-command="retry_outbox"/);
  assert.match(markup, /id="outboxDetail"/);
});


test('Pilot exposes exact batch proof inspection', () => {
  assert.match(markup, /class="live-panel proof-panel"/);
  assert.match(markup, /id="proofState"/);
  assert.match(markup, /id="proofDetail"/);
});


test('Pilot exposes Memory Guard and safe proven-history compaction', () => {
  assert.match(markup, /id="memoryBreakdown"/);
  assert.match(markup, /data-command="compact_proven"/);
});


test('Pilot exposes an accessible decisive Interview Readiness Gate', () => {
  assert.match(markup, /id="readinessGate"[^>]*aria-live="polite"/);
  assert.match(markup, /id="readinessBlockers"/);
  assert.match(markup, /Interview readiness/);
});


test('Pilot exposes the current update lane as a Runtime Efficiency indicator', () => {
  assert.match(markup, /id="runtimeEfficiency">Waiting/);
});


test('heartbeat updates use the lightweight role-only render path', () => {
  const source = dashboard;
  const branch = source.slice(
    source.indexOf("message?.type === 'PMIA_DASHBOARD_HEARTBEAT'"),
    source.indexOf("message?.type === 'PMIA_DASHBOARD_COMMAND_RESULT'")
  );
  assert.match(branch, /render\(\[message\.role\]\)/);
  assert.doesNotMatch(branch, /render\(\);/);
});


test('Pilot exposes semantic Recovery Progress rather than a binary repair flag', () => {
  assert.match(markup, /class="live-panel recovery-panel"/);
  assert.match(markup, /id="recoveryChecks"/);
});


test('Pilot exposes a one-click Safe Health Report separate from diagnostics', () => {
  assert.match(markup, /id="copyHealthReport"/);
  assert.match(markup, /Copy health report/);
});


test('Runtime Pilot exposes hidden receiver scheduler evidence', () => {
  assert.match(dashboardHtml, /id="hiddenRuntimeState"/);
  assert.match(dashboardHtml, /id="hiddenRuntimeTitle"/);
  assert.match(dashboardHtml, /id="hiddenRuntimeDetail"/);
  assert.match(dashboardJs, /receiver\?\.schedulerState/);
});


test('Runtime Pilot exposes recent command results and replay counts', () => {
  assert.match(dashboardHtml, /id="commandJournalList"/);
  assert.match(dashboardJs, /snapshot\?\.commandJournal/);
  assert.match(dashboardJs, /replayed \$\{command\.replayCount\}/);
});


test('Runtime Pilot exposes direct-port circuit and fallback state', () => {
  assert.match(markup, /id="senderTransportLane"/);
  assert.match(markup, /id="receiverTransportLane"/);
  assert.match(dashboard, /deriveTransportLanes\(snapshot, now\)/);
  assert.match(styles, /\.transport-lane-list/);
});


test('Runtime Pilot exposes protected batch partition plan', () => {
  assert.match(markup, /id="batchPlanState"/);
  assert.match(markup, /id="batchPlanDetail"/);
  assert.match(dashboard, /deriveBatchPlan\(snapshot\)/);
});


test('Runtime Pilot exposes explicit receiver draft conflict resolutions', () => {
  assert.match(markup, /data-command="resolve_draft_keep_manual"/);
  assert.match(markup, /data-command="resolve_draft_restore_pmia"/);
  assert.match(markup, /data-command="resolve_draft_merge"/);
  assert.match(dashboard, /deriveDraftConflict\(snapshot\)/);
});


test('Runtime Pilot exposes Delivery SLA escalation state', () => {
  assert.match(markup, /id="deliverySlaState"/);
  assert.match(markup, /id="deliverySlaDetail"/);
  assert.match(dashboard, /deriveDeliverySlaView\(snapshot\)/);
});


test('Runtime Pilot exposes durable recovery deadline and source', () => {
  assert.match(markup, /id="recoveryScheduleState"/);
  assert.match(markup, /id="recoveryScheduleDetail"/);
  assert.match(dashboard, /deriveRecoverySchedule\(snapshot, now\)/);
});


test('Runtime Pilot reports sender outbox restoration source without content', () => {
  assert.match(dashboard, /outbox\.restoredCount/);
  assert.match(dashboard, /outbox\.recoverySource/);
});
