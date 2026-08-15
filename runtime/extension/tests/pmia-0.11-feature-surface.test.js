import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
const markup = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');
const launcher = await readFile(new URL('../../Final_2_Window_Extension.ahk', import.meta.url), 'utf8');
const background = await readFile(new URL('../background.js', import.meta.url), 'utf8');

test('0.11 cockpit exposes manual gather live analytics and help companion', () => {
  for (const id of ['manualGatherAction','primaryAnalyticsSummary','comparisonAnalyticsSummary','helpCompanionButton','shortcutHelpDialog']) {
    assert.match(markup, new RegExp(`id="${id}"`));
  }
  assert.match(markup, /Manual gather/);
  assert.match(markup, /Comparison lane/);
  assert.match(dashboard, /downloadSessionAnalysis/);
  assert.match(dashboard, /Role activity/);
  assert.match(dashboard, /P95 first token/);
  assert.match(dashboard, /Generation/);
  assert.match(dashboard, /Speaking estimate/);
  assert.match(dashboard, /Target word band/);
  assert.match(dashboard, /onTargetRatePct/);
  assert.match(dashboard, /analysis\.roles/);
});

test('0.11 launcher exposes optional comparison provider with restored fixed workspace geometry', () => {
  assert.match(launcher, /Compare answers/);
  assert.match(launcher, /pmia_role=comparison|"comparison"/);
  assert.match(launcher, /layout2Win :=/);
  assert.match(launcher, /Apply2WinLayout\(1, true\)/);
  assert.match(launcher, /Apply2WinLayout\(1, false\)/);
});

test('comparison delivery is fire-and-forget relative to canonical receiver delivery', () => {
  assert.match(background, /function mirrorToComparison/);
  assert.match(background, /void deliverToRole\(route, registry, 'comparison'\)/);
  assert.match(background, /const route = registry\.route\(envelope\.sessionId, envelope\);[\s\S]{0,160}mirrorToComparison\(envelope, registry\)/);
});

test('comparison launch failure degrades to primary-only instead of blocking the interview', () => {
  const launchStart = launcher.indexOf('RunManagedLaunch(reuseSession := false) {');
  const launchEnd = launcher.indexOf('\n}\n\n', launchStart);
  const launch = launcher.slice(launchStart, launchEnd);
  assert.match(launch, /if !LaunchComparisonRuntime\(\) \{/);
  assert.match(launch, /continuing primary/i);
  assert.doesNotMatch(launch, /if !LaunchComparisonRuntime\(\)\s*return false/);
});

test('comparison observation-log failure cannot be reclassified as delivery failure', () => {
  const start = background.indexOf('function mirrorToComparison(envelope, registry) {');
  const end = background.indexOf('\nasync function handleRegistration', start);
  const block = background.slice(start, end);
  assert.match(block, /\.then\(outcome => \{/);
  assert.match(block, /appendLog\(envelope\.sessionId, 'comparison',[\s\S]*\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(block, /\.then\(outcome => appendLog/);
});

test('live analytics render missing timing evidence as pending instead of zero milliseconds', () => {
  assert.match(dashboard, /Timing pending/);
  assert.doesNotMatch(dashboard, /formatDuration\(value\.firstTokenMs \|\| 0\)/);
});

test('session-analysis HTML renders absent aggregate timing as pending rather than zero milliseconds', () => {
  assert.match(dashboard, /analysisMetric/);
  assert.match(dashboard, /analysisDuration/);
  assert.doesNotMatch(dashboard, /overall\.averageFirstTokenMs \|\| 0/);
  assert.doesNotMatch(dashboard, /value\.averageFirstTokenMs \|\| 0/);
});

test('Live cockpit keeps interview-critical surfaces visible and collapses deep diagnostics by default', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../dashboard/dashboard.css', import.meta.url), 'utf8');
  assert.match(html, /id="toggleLiveDetails"[^>]*>Show details</);
  assert.match(html, /class="control-grid essential-controls"/);
  assert.match(html, /class="live-session-console cockpit-advanced"/);
  assert.match(html, /class="latency-section cockpit-advanced"/);
  assert.match(html, /class="role-grid cockpit-advanced"/);
  assert.match(html, /class="warnings cockpit-advanced"/);
  assert.match(js, /toggleLiveDetails/);
  assert.match(js, /document\.body\.dataset\.liveDetails/);
  assert.match(css, /body:not\(\[data-live-details="true"\]\).*\.cockpit-advanced/);
});
test('Live cockpit exposes a compact question-path trace and moves secondary controls behind details', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
  const renderer = await readFile(new URL('../dashboard/render-question-path.js', import.meta.url), 'utf8');
  assert.match(html, /id="questionPathStages"/);
  assert.match(html, /id="questionPathDetail"/);
  assert.match(renderer, /deriveLatestQuestionPath/);
  assert.match(renderer, /export function renderQuestionPath/);
  assert.match(js, /renderQuestionPath/);
  assert.match(html, /id="submitNow"[^>]*class="cockpit-advanced/);
  assert.match(html, /id="interruptLatest"[^>]*cockpit-advanced/);
  assert.match(html, /data-command="run_self_test"[^>]*class="cockpit-advanced"|class="cockpit-advanced"[^>]*data-command="run_self_test"/);
  assert.match(html, /data-command="run_preflight"[^>]*class="cockpit-advanced"|class="cockpit-advanced"[^>]*data-command="run_preflight"/);
});
