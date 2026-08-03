import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const builder = fileURLToPath(new URL('../../scripts/build-release-evidence-manifest.mjs', import.meta.url));
const run = (cwd, args) => spawnSync(process.execPath, [builder, ...args], { cwd, encoding: 'utf8' });
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });

async function fixture({ cleanup = true, normalProfileTouched = false, smokeCommit = '' } = {}) {
  const repo = await mkdtemp(path.join(tmpdir(), 'pmia-release-evidence-'));
  await mkdir(path.join(repo, 'runtime/extension'), { recursive: true });
  await mkdir(path.join(repo, 'runtime/scripts'), { recursive: true });
  await writeFile(path.join(repo, 'runtime/extension/manifest.json'), JSON.stringify({ name: 'PMIA', version: '0.8.0' }));
  await writeFile(path.join(repo, 'runtime/extension/background.js'), 'export const ready = true;\n');
  await writeFile(path.join(repo, 'runtime/scripts/helper.mjs'), 'export const helper = true;\n');
  git(repo, ['init']); git(repo, ['config', 'user.email', 'pmia@example.invalid']); git(repo, ['config', 'user.name', 'PMIA Test']);
  git(repo, ['add', '.']); git(repo, ['commit', '-m', 'fixture']);
  const commit = git(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const gate = path.join(repo, 'gate.log');
  const smoke = path.join(repo, 'smoke.json');
  await writeFile(gate, '# tests 10\n# pass 10\n# fail 0\nExtension validation passed: 5 JavaScript files, 2 required runtime surfaces, and 3 reachable production modules checked.\n');
  await writeFile(smoke, JSON.stringify({
    ok: true, deliveryProofOk: true, adaptiveTurnScenariosOk: true,
    adaptiveTurnScenarios: Object.fromEntries(['authoritativeFinal','pauseResume','carryover','independentAccumulation','restartRecovery'].map(key => [key, { ok: true }])),
    transportDrillOk: true, pilotUiOk: true, productionUiOk: true, assistUiOk: true, reliabilityUiOk: true, operationsUiOk: true,
    commandReachability: { ok: true, duplicateDomIds: [], visibleWithoutRegistry: [], visibleWithoutOwner: [] },
    commandRegistryDigest: 'registry-v1',
    commit: smokeCommit || commit,
    finals: [{ id: 'q1' }], gap: { clear: true }, outbox: { count: 0 },
    pilotUi: Object.fromEntries(['desktop','mobile','tiny','print'].map(key => [key, { viewport: { width: key === 'mobile' ? 320 : key === 'tiny' ? 280 : 1200 }, horizontalOverflow: false, accessibility: { polite: true, assertive: true, shortcutDialog: true } }])),
    productionUi: Object.fromEntries(['desktop','mobile','tiny','print'].map(key => [key, { viewport: { width: key === 'mobile' ? 320 : key === 'tiny' ? 280 : 1200 }, horizontalOverflow: false, controlCount: 8 }])),
    assistUi: Object.fromEntries(['desktop','mobile','tiny','print'].map(key => [key, { viewport: { width: key === 'mobile' ? 320 : key === 'tiny' ? 280 : 1200 }, horizontalOverflow: false, controlCount: 8, actionDock: true }])),
    operationsUi: Object.fromEntries(['desktop','mobile','tiny','print'].map(key => [key, { viewport: { width: key === 'mobile' ? 320 : key === 'tiny' ? 280 : 1200 }, horizontalOverflow: false, viewCount: 10, scenarioCount: 5, itemCount: 4, privacy: 'safe', commandJournalDelta: 0 }])),
    cleanup: { processTreeClosed: cleanup, profileRemoved: cleanup },
    isolatedProfile: { normalProfileTouched }
  }));
  return { repo, commit, gate, smoke };
}

function args(value, output) {
  return ['--repo', value.repo, '--gate-log', value.gate, '--smoke-evidence', value.smoke, '--output', output];
}

test('release evidence output is deterministic and source-bound', async () => {
  const value = await fixture();
  const first = path.join(value.repo, 'first.json');
  const second = path.join(value.repo, 'second.json');
  assert.equal(run(value.repo, args(value, first)).status, 0);
  assert.equal(run(value.repo, args(value, second)).status, 0);
  const one = JSON.parse(await readFile(first, 'utf8'));
  const two = JSON.parse(await readFile(second, 'utf8'));
  assert.deepEqual(one, two);
  assert.equal(one.commit, value.commit);
  assert.equal(one.gate.failed, 0);
  assert.equal(one.cleanup.normalProfileTouched, false);
  assert.match(one.manifestHash, /^[a-f0-9]{64}$/);
  assert.match(one.sourceHashes['runtime/extension/background.js'], /^[a-f0-9]{64}$/);
});

test('release evidence rejects commit mismatch and incomplete cleanup', async () => {
  const mismatch = await fixture({ smokeCommit: 'deadbeef' });
  const mismatchResult = run(mismatch.repo, args(mismatch, path.join(mismatch.repo, 'out.json')));
  assert.notEqual(mismatchResult.status, 0);
  assert.match(mismatchResult.stderr, /Smoke commit mismatch/);

  const cleanup = await fixture({ cleanup: false });
  const cleanupResult = run(cleanup.repo, args(cleanup, path.join(cleanup.repo, 'out.json')));
  assert.notEqual(cleanupResult.status, 0);
  assert.match(cleanupResult.stderr, /cleanup evidence is incomplete/i);
});

test('release evidence rejects missing Production or Operations UI and command reachability evidence', async () => {
  const value = await fixture();
  const smoke = JSON.parse(await readFile(value.smoke, 'utf8'));
  smoke.productionUiOk = false;
  await writeFile(value.smoke, JSON.stringify(smoke));
  const production = run(value.repo, args(value, path.join(value.repo, 'production-fail.json')));
  assert.notEqual(production.status, 0);
  assert.match(production.stderr, /Production UI evidence is incomplete|transport, Pilot UI, Production UI, or Assist or Reliability UI/i);

  smoke.productionUiOk = true;
  smoke.operationsUiOk = false;
  await writeFile(value.smoke, JSON.stringify(smoke));
  const operations = run(value.repo, args(value, path.join(value.repo, 'operations-fail.json')));
  assert.notEqual(operations.status, 0);
  assert.match(operations.stderr, /Operations Lab|transport, Pilot UI/);

  smoke.operationsUiOk = true;
  smoke.commandReachability = { ok: false };
  await writeFile(value.smoke, JSON.stringify(smoke));
  const reachability = run(value.repo, args(value, path.join(value.repo, 'reachability-fail.json')));
  assert.notEqual(reachability.status, 0);
  assert.match(reachability.stderr, /command reachability evidence is incomplete/i);
});

test('release evidence rejects normal-profile access and missing required options', async () => {
  const touched = await fixture({ normalProfileTouched: true });
  const touchedResult = run(touched.repo, args(touched, path.join(touched.repo, 'out.json')));
  assert.notEqual(touchedResult.status, 0);
  assert.match(touchedResult.stderr, /normal profile access/i);

  const missing = run(touched.repo, []);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Required options/);
});


test('runtime validator exposes optional commit-bound release evidence generation', async () => {
  const source = await readFile(new URL('../../Validate_Extension_Runtime.ps1', import.meta.url), 'utf8');
  assert.match(source, /\[string\]\$GateLog/);
  assert.match(source, /\[string\]\$SmokeEvidence/);
  assert.match(source, /\[string\]\$EvidenceManifest/);
  assert.match(source, /build-release-evidence-manifest\.mjs/);
  assert.match(source, /--repo[\s\S]*--gate-log[\s\S]*--smoke-evidence[\s\S]*--output/);
});


test('release evidence requires every Adaptive Turn scenario', async () => {
  const value = await fixture();
  const smoke = JSON.parse(await readFile(value.smoke, 'utf8'));
  smoke.adaptiveTurnScenariosOk = false;
  await writeFile(value.smoke, JSON.stringify(smoke));
  const aggregate = run(value.repo, args(value, path.join(value.repo, 'adaptive-fail.json')));
  assert.notEqual(aggregate.status, 0);
  assert.match(aggregate.stderr, /Adaptive Turn scenarios are incomplete/);

  smoke.adaptiveTurnScenariosOk = true;
  smoke.adaptiveTurnScenarios.carryover.ok = false;
  await writeFile(value.smoke, JSON.stringify(smoke));
  const carryover = run(value.repo, args(value, path.join(value.repo, 'carryover-fail.json')));
  assert.notEqual(carryover.status, 0);
  assert.match(carryover.stderr, /carryover is incomplete/);
});
