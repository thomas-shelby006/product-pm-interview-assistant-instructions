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
  assert.match(powershell, /deterministicBrowser\.ok[\s\S]*processClosed[\s\S]*profileRemoved/);
  assert.match(powershell, /providerCanary\.status/);
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


test('smoke mirrors the production ChatGPT composer, send, and transcript selectors', () => {
  assert.match(runner, /textarea\[name="prompt-textarea"\]/);
  assert.match(runner, /#prompt-textarea/);
  assert.match(runner, /contenteditable="true"\]\[role="textbox"\]/);
  assert.match(runner, /button\[aria-label\^="Send"\]/);
  assert.match(runner, /'value' in composer/);
  assert.match(runner, /data-message-author-role/);
  assert.match(runner, /data-conversation-transcript/);
  assert.match(runner, /data-message-role/);
  assert.match(runner, /data-user-message-copy/);
  assert.match(runner, /data-user-message-bubble/);
  assert.match(runner, /data-submit-message-animation-target/);
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
  assert.match(powershell, /\$evidence\.deterministicBrowser\.ok/);
  assert.match(powershell, /\$evidence\.providerCanary\.status -eq 'passed'/);
  assert.match(runner, /productionUi: evidence\.productionUiOk/);
  assert.match(runner, /assistUi: evidence\.assistUiOk/);
  assert.match(runner, /reliabilityUi: evidence\.reliabilityUiOk/);
  assert.match(runner, /operationsUi: evidence\.operationsUiOk/);
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
  assert.match(runner, /operationsCommandIsolation/);
  assert.match(runner, /concurrentCommands/);
  assert.match(runner, /commandFreeSourceContract/);
  assert.match(runner, /keyboardMoved===true/);
  assert.doesNotMatch(runner, /commandJournalDelta===0/);
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


test('isolated smoke recovers redirected providers with bounded navigation and replacement', () => {
  assert.match(runner, /sampleManagedLifecycle/);
  assert.match(runner, /Page\.navigate/);
  assert.match(runner, /managed lifecycle ready after provider navigation/);
  assert.match(runner, /managed lifecycle ready after provider replacement/);
  assert.match(runner, /providerNavigations/);
  assert.match(runner, /providerReplacements/);
  assert.match(runner, /Target\.closeTarget/);
  assert.match(runner, /lifecycleRecovery\.recovered/);
});


test('isolated smoke keeps explicit no-response Continue available through the full proof wait', () => {
  assert.match(runner, /async function resolvePendingNoResponse\(current\)/);
  assert.match(runner, /await resolvePendingNoResponse\(pilot\)/);
  assert.match(runner, /evidence\.noResponseResolution\.completedAt \? await pilotState\(\) : pilot/);
  assert.match(runner, /three exact rendered proofs[\s\S]*150000/);
});


test('isolated smoke reads long-lived Pilot state through the persistent dashboard target', () => {
  assert.match(runner, /const role = dashboard \? 'dashboard' : 'worker'/);
  assert.match(runner, /evaluateRead\(role,[\s\S]*'pilot_state'\)/);
});


test('isolated smoke reconnects one stalled target only for idempotent reads', () => {
  assert.match(runner, /async function evaluateRead\(role, expression, label = role\)/);
  assert.match(runner, /evidence\.cdpReadRecoveries\.push/);
  assert.match(runner, /const replacement = await targetClient\(targetId\)/);
  assert.match(runner, /return replacement\.evaluate\(expression\)/);
  assert.match(runner, /async function pageState\(role\)[\s\S]*evaluateRead\(role/);
  assert.match(runner, /async function pilotState\(\)[\s\S]*evaluateRead\(role/);
});

test('isolated smoke never routes provider writes through read retry recovery', () => {
  const helper = runner.slice(runner.indexOf('async function evaluateRead'), runner.indexOf('async function pilotState'));
  assert.doesNotMatch(helper, /Input\.|button\.click|insertText|dispatchKeyEvent/);
  const q1 = runner.slice(runner.indexOf('async function submitSyntheticQ1Attempt'), runner.indexOf('let sourceSubmission'));
  assert.match(q1, /sender\.send\('Input\.insertText'/);
  assert.match(q1, /button\.click\(\)/);
  assert.doesNotMatch(q1, /evaluateRead\([^)]*button\.click/);
});


test('isolated smoke admits each manual-copy final before injecting the next one', () => {
  assert.match(runner, /async function manualCopyAndAwaitOwnership\(label, text\)/);
  assert.match(runner, /manualCopyAdmissions:\s*\[\]/);
  assert.match(runner, /waitFor\(`\$\{label\} admitted to durable ownership`/);
  const q2At = runner.indexOf("await manualCopyAndAwaitOwnership('Q2', questions.q2)");
  const q3At = runner.indexOf("await manualCopyAndAwaitOwnership('Q3', questions.q3)");
  const proofAt = runner.indexOf("waitFor('three exact rendered proofs'");
  assert.ok(q2At >= 0);
  assert.ok(q3At > q2At);
  assert.ok(proofAt > q3At);
});


test('isolated smoke proves all five Adaptive Turn scenarios', () => {
  for (const key of [
    'authoritativeFinal', 'pauseResume', 'carryover',
    'independentAccumulation', 'restartRecovery'
  ]) {
    assert.match(runner, new RegExp(`${key}: \\{ ok: false \\}`));
  }
  assert.match(runner, /runAdaptiveModuleScenarios/);
  assert.match(runner, /paused combined draft mirrored in Window 2/);
  assert.match(runner, /FORWARDING PAUSED/i);
  assert.match(runner, /resume_catch_up/);
  assert.match(runner, /rendered_user_turn/);
  assert.match(runner, /stopCalls===1/);
  assert.match(runner, /independentAccumulation/);
  assert.match(runner, /restoredMode/);
  assert.match(runner, /adaptiveTurnScenariosOk/);
});

test('isolated smoke final gate and cleanup retain Adaptive Turn evidence', () => {
  assert.match(runner, /deriveReleaseVerificationStatus/);
  assert.match(runner, /deterministicBrowser = verification\.deterministicBrowser/);
  assert.match(powershell, /\$evidence\.deterministicBrowser\.ok/);
});


test('adaptive module scenarios run in the packaged dashboard page not the service worker', () => {
  assert.match(runner, /async function runAdaptiveModuleScenarios\(client\)/);
  assert.match(runner, /const raw = await client\.evaluate/);
  assert.match(runner, /dashboard = await targetClient\(dashboardTarget\);[\s\S]*runAdaptiveModuleScenarios\(dashboard\)/);
  const scenarioBody = runner.slice(
    runner.indexOf('async function runAdaptiveModuleScenarios'),
    runner.indexOf('\ntry {', runner.indexOf('async function runAdaptiveModuleScenarios'))
  );
  assert.doesNotMatch(scenarioBody, /worker\.evaluate/);
});


test('isolated smoke waits for each paused admission projection before combined proof', async () => {
  const runner = await readFile(new URL('../../scripts/isolated-release-smoke.mjs', import.meta.url), 'utf8');
  assert.match(runner, /async function awaitPausedBatchProjection/);
  assert.match(runner, /await awaitPausedBatchProjection\('Q2'/);
  assert.match(runner, /await awaitPausedBatchProjection\('Q3'/);
});


test('isolated smoke limits only the exact provider-render timeout', () => {
  assert.match(runner, /String\(error\?\.message \|\| error\) !== 'Timed out: three exact rendered proofs'/);
  assert.match(runner, /throw error/);
});

test('a passed provider canary still requires clear outbox and sequence state', () => {
  assert.match(runner, /providerCanary\.status === 'passed'/);
  assert.match(runner, /evidence\.outbox\.count !== 0 \|\| !evidence\.gap\.clear/);
  assert.match(runner, /reason: 'delivery_state_not_clear'/);
});