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
  assert.match(powershell, /Get-OwnedEdgeProcesses/);
  assert.match(powershell, /CommandLine[\s\S]*OwnedProfile/);
  assert.match(powershell, /processClosed = @\(Get-OwnedEdgeProcesses \$profile\)\.Count -eq 0/);
  assert.match(powershell, /Remove-Item[\s\S]*profile/i);
  assert.doesNotMatch(powershell, /Edge\\User Data\\Default|--profile-directory=Default/);
});

test('isolated smoke decodes legacy arrays and versioned session envelopes', () => {
  assert.match(runner, /Array\.isArray\(stored\)\?stored:\(Array\.isArray\(stored\?\.sessions\)\?stored\.sessions:\[\]\)/);
});

test('isolated smoke uses fixed synthetic questions and exact proof checks', () => {
  assert.match(runner, /Synthetic PMIA release Q1/);
  assert.match(runner, /Synthetic PMIA release Q2/);
  assert.match(runner, /Synthetic PMIA release Q3/);
  assert.match(runner, /every\(item => item\.state === 'proven'\)/);
  assert.match(runner, /senderOutboxState/);
  assert.match(runner, /sequence_gap/);
  assert.doesNotMatch(runner, /resumeText|job description|clipboard\.readText|setupText/i);
});

test('isolated smoke writes structured evidence and distinguishes answer limitations', () => {
  for (const key of ['isolatedProfile', 'extensions', 'selfTest', 'finals', 'batches', 'ledger', 'outbox', 'gap', 'answerCapability', 'cleanup', 'limitations', 'operationsUi']) {
    assert.match(runner, new RegExp(`${key}:`));
  }
  assert.match(runner, /anonymous_answer_unavailable/);
  assert.match(runner, /deliveryProofOk/);
});

test('isolated smoke runs the complete no-content transport drill', () => {
  assert.match(runner, /runTransportDrill/);
  assert.match(runner, /checks\.length === 12/);
  assert.match(runner, /contentAccessed === false/);
  assert.match(runner, /transportDrillOk/);
});

test('isolated smoke validates Pilot mechanics at desktop and 320 CSS pixels', () => {
  assert.match(runner, /Emulation\.setDeviceMetricsOverride/);
  assert.match(runner, /dashboardUiState\(1200, 900, 'desktop'\)/);
  assert.match(runner, /dashboardUiState\(320, 900, '320px'\)/);
  assert.match(runner, /horizontalOverflow/);
  assert.match(runner, /Page\.captureScreenshot/);
  assert.match(runner, /pilotUiOk/);
});

test('cleanup preserves every release gate in final evidence', () => {
  assert.match(powershell, /deliveryProofOk[\s\S]*transportDrillOk[\s\S]*pilotUiOk[\s\S]*operationsUiOk[\s\S]*processClosed[\s\S]*profileRemoved/);
});

test('smoke failure evidence preserves the final readiness sample', () => {
  assert.match(runner, /failureDetails/);
  assert.match(runner, /error\?\.last/);
  assert.match(runner, /sendControls/);
});

test('complete validator requires the repository-owned smoke surfaces', () => {
  assert.match(validator, /run-isolated-release-smoke\.ps1/);
  assert.match(validator, /isolated-release-smoke\.mjs/);
});
test('smoke waits for exact ready titles without inventing a lifecycle token', () => {
  assert.match(runner, /PMIA_SENDER_CHATGPT_\$\{suffix\}/);
  assert.match(runner, /PMIA_RECEIVER_CHATGPT_\$\{suffix\}/);
  assert.doesNotMatch(runner, /CHATGPT_READY_/);
});

test('smoke waits for the provider send control instead of sleeping', () => {
  assert.match(runner, /waitFor\(`Q1 send control ready \(attempt \$\{attempt\}\)`/);
  assert.match(runner, /value\.composer === questions\.q1 && value\.sendReady/);
  assert.doesNotMatch(runner, /Input\.insertText'[\s\S]{0,200}sleep\(/);
});


test('smoke never rewrites provider composer DOM before input', () => {
  assert.match(runner, /editor\.focus\(\)/);
  assert.match(runner, /Input\.insertText/);
  assert.doesNotMatch(runner, /editor\.innerHTML|deleteContentBackward/);
});


test('smoke mirrors the production ChatGPT composer and send selectors', () => {
  assert.match(runner, /textarea\[name="prompt-textarea"\]/);
  assert.match(runner, /#prompt-textarea/);
  assert.match(runner, /contenteditable="true"\]\[role="textbox"\]/);
  assert.match(runner, /button\[aria-label\^="Send"\]/);
  assert.match(runner, /'value' in composer/);
});


test('isolated smoke resolves explicit no-response hold through the visible Continue control', () => {
  assert.match(runner, /batchState\?\.pendingNoResponse/);
  assert.match(runner, /data-choice-option=\"continue\"/);
  assert.match(runner, /noResponseResolution = \{ required: true, action: 'continue'/);
});


test('isolated smoke waits for an enabled visible transport drill control', () => {
  assert.match(runner, /transport drill control ready/);
  assert.match(runner, /runTransportDrill/);
  assert.match(runner, /!value\.disabled/);
  assert.match(runner, /reviewActive/);
});

test('isolated smoke validates the Production view at responsive and print widths', () => {
  assert.match(runner, /productionUiOk/);
  assert.match(runner, /panelProduction/);
  for (const id of ['productionDecisionTitle','operatingProfileSelect','containmentState','transportAssuranceState','routeReadinessState','upgradeReadinessState','liveScoreValue','productionDiagnosticsState','releaseHandoffState']) {
    assert.match(runner, new RegExp(id));
  }
});


test('isolated smoke reactivates Review and waits for rendered drill and trace evidence per viewport', () => {
  assert.match(runner, /Review evidence ready/);
  assert.equal(runner.includes(`data-view=\"review\"`), true);
  assert.match(runner, /value\.reviewActive && value\.drillReportReady && value\.traceResultCount >= 3/);
  assert.match(runner, /Production evidence ready/);
  assert.match(runner, /value\.health !== 'Waiting'/);
});


test('isolated smoke opens Assist and waits for the explicit no-response Continue choice', () => {
  assert.match(runner, /explicit no-response Continue choice ready/);
  assert.equal(runner.includes(`data-view=\"assist\"`), true);
  assert.match(runner, /value\.exists && !value\.hidden && !value\.disabled && value\.visible && value\.assistActive && value\.choiceId && value\.fingerprint/);
});


test('isolated smoke proves Q1 in Window 1 and allows one bounded swallowed-submit retry', () => {
  assert.match(runner, /submitSyntheticQ1Attempt/);
  assert.match(runner, /Q1 rendered in sender/);
  assert.match(runner, /attempt <= 2/);
  assert.match(runner, /sourceSubmission = \{ attempts: attempt, rendered: sourceSubmission\.ok/);
  assert.match(runner, /Synthetic Q1 did not render in sender/);
});


test('isolated smoke wrapper binds evidence to HEAD and preserves every final UI gate after cleanup', () => {
  assert.match(powershell, /git -C \$repositoryRoot rev-parse HEAD/);
  assert.match(powershell, /--source-commit \$sourceCommit/);
  for (const gate of ['productionUiOk','assistUiOk','reliabilityUiOk','operationsUiOk']) assert.match(powershell, new RegExp(`-and \\$evidence\\.${gate}`));
});


test('isolated smoke waits for a late first render before using its one source-submit retry', () => {
  assert.match(runner, /Q1 late render before retry/);
  assert.match(runner, /lateGraceUsed/);
  assert.match(runner, /if \(attempt === 1\)/);
  assert.match(runner, /20000, 250/);
});

test('isolated smoke waits for all twenty Reliability Center rows before capture', () => {
  assert.match(runner, /reliabilityRows===20/);
  assert.match(runner, /reliabilityState!==['"]Waiting['"]/);
});


test('isolated smoke proves Operations Lab views scenarios keyboard privacy and four layouts', () => {
  assert.match(runner, /operationsUiState/);
  assert.match(runner, /viewCount===10/);
  assert.match(runner, /scenarioCount===5/);
  assert.match(runner, /itemCount===4/);
  assert.match(runner, /commandJournalDelta===0/);
  assert.match(runner, /keyboardMoved===true/);
  assert.match(runner, /operationsUiOk/);
});


test('isolated smoke bounds MV3 worker discovery and suppresses Edge onboarding background noise', () => {
  assert.match(runner, /value\.type === 'service_worker'/);
  assert.doesNotMatch(runner, /\['service_worker', 'background_page'\]/);
  assert.match(runner, /AbortSignal\.timeout\(5000\)/);
  assert.match(runner, /CDP open timed out/);
  assert.match(powershell, /--disable-sync/);
  assert.match(powershell, /--disable-component-extensions-with-background-pages/);
});


test('isolated smoke retries lifecycle registration with one bounded provider reload', () => {
  assert.match(runner, /sampleManagedLifecycle/);
  assert.match(runner, /managed lifecycle ready after provider reload/);
  assert.match(runner, /Page\.reload/);
  assert.match(runner, /providerReloads = 2/);
  assert.match(runner, /lifecycleRecovery\.recovered/);
});
