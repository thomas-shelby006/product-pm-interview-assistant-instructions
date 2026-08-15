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

test('0.11 launcher exposes optional comparison provider and adaptive compact workspace', () => {
  assert.match(launcher, /Compare answers/);
  assert.match(launcher, /pmia_role=comparison|"comparison"/);
  assert.match(launcher, /MonitorGetWorkArea/);
  assert.match(launcher, /WinSetStyle "-0xC00000"/);
  assert.match(launcher, /ApplyAdaptiveWorkspaceLayout/);
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
