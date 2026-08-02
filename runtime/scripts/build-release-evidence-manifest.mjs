import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

function args(argv) {
  const output = {};
  for (let index = 2; index < argv.length; index += 2) output[String(argv[index] || '').replace(/^--/, '')] = argv[index + 1];
  return output;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}
function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }

const options = args(process.argv);
const repoOption = String(options.repo || '').trim();
const gateOption = String(options['gate-log'] || '').trim();
const smokeOption = String(options['smoke-evidence'] || '').trim();
const outputOption = String(options.output || '').trim();
if (!repoOption || !gateOption || !smokeOption || !outputOption) {
  throw new Error('Required options: --repo, --gate-log, --smoke-evidence, --output');
}
const repo = path.resolve(repoOption);
const gateLog = path.resolve(gateOption);
const smokeEvidence = path.resolve(smokeOption);
const outputPath = path.resolve(outputOption);
if (!await exists(repo)) throw new Error('Repository path missing');
if (!await exists(gateLog)) throw new Error('Gate log missing');
if (!await exists(smokeEvidence)) throw new Error('Smoke evidence missing');

const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' });
if (git.status !== 0) throw new Error(git.stderr || 'Unable to resolve repository commit');
const commit = git.stdout.trim();
const manifest = JSON.parse(await fs.readFile(path.join(repo, 'runtime/extension/manifest.json'), 'utf8'));
const gateText = await fs.readFile(gateLog, 'utf8');
const smoke = JSON.parse(await fs.readFile(smokeEvidence, 'utf8'));
const smokeCommit = String(smoke.commit || smoke.sourceCommit || '').trim();
if (!smokeCommit) throw new Error('Smoke evidence is not bound to a source commit');
if (smokeCommit !== commit) throw new Error(`Smoke commit mismatch: ${smokeCommit} != ${commit}`);
if (smoke.ok !== true || smoke.deliveryProofOk !== true) throw new Error('Smoke evidence did not pass delivery proof');
if (smoke.cleanup?.processTreeClosed !== true || smoke.cleanup?.profileRemoved !== true) throw new Error('Smoke cleanup evidence is incomplete');
if (smoke.isolatedProfile?.normalProfileTouched === true) throw new Error('Smoke evidence reports normal profile access');
if (smoke.transportDrillOk !== true || smoke.pilotUiOk !== true || smoke.productionUiOk !== true || smoke.assistUiOk !== true || smoke.reliabilityUiOk !== true || smoke.operationsUiOk !== true) throw new Error('Smoke transport, Pilot UI, Production UI, or Assist or Reliability UI evidence is incomplete');
if (smoke.commandReachability?.ok !== true || !String(smoke.commandRegistryDigest || '')) throw new Error('Smoke command reachability evidence is incomplete');
for (const view of ['desktop','mobile','tiny','print']) {
  const proof = smoke.pilotUi?.[view];
  const productionProof = smoke.productionUi?.[view];
  const assistProof = smoke.assistUi?.[view];
  const operationsProof = smoke.operationsUi?.[view];
  if (!proof || proof.horizontalOverflow === true || proof.accessibility?.polite !== true || proof.accessibility?.assertive !== true) throw new Error(`Smoke ${view} accessibility/reflow evidence is incomplete`);
  if (!productionProof || productionProof.horizontalOverflow === true || productionProof.controlCount < 1) throw new Error(`Smoke Production ${view} evidence is incomplete`);
  if (!assistProof || assistProof.horizontalOverflow === true || assistProof.controlCount < 1 || assistProof.actionDock !== true) throw new Error(`Smoke Assist ${view} evidence is incomplete`);
  if (!operationsProof || operationsProof.horizontalOverflow === true || operationsProof.viewCount !== 10 || operationsProof.scenarioCount !== 5 || operationsProof.itemCount !== 4 || operationsProof.privacy !== 'safe' || operationsProof.commandJournalDelta !== 0) throw new Error(`Smoke Operations Lab ${view} evidence is incomplete`);
}

const tracked = spawnSync('git', ['ls-files', '-z', 'runtime/extension', 'runtime/*.ahk', 'runtime/scripts'], { cwd: repo, encoding: 'buffer' });
if (tracked.status !== 0) throw new Error('Unable to enumerate release sources');
const relativeFiles = tracked.stdout.toString('utf8').split('\0').filter(Boolean)
  .filter(file => !file.includes('/tests/') && !file.includes('/testing/') && !file.endsWith('.log'))
  .sort((a, b) => a.localeCompare(b));
const sourceHashes = {};
for (const relative of relativeFiles) sourceHashes[relative.replaceAll('\\', '/')] = digest(await fs.readFile(path.join(repo, relative)));

const tests = /tests\s+(\d+)[\s\S]*?pass\s+(\d+)[\s\S]*?fail\s+(\d+)/m.exec(gateText);
const validation = /Extension validation passed:\s*(\d+) JavaScript files,\s*(\d+) required runtime surfaces,\s*and\s*(\d+) reachable production modules checked\./m.exec(gateText);
if (!tests || !validation) throw new Error('Gate log does not contain required counts');
const value = canonical({
  format: 'pmia-release-evidence-v1',
  commit,
  version: String(manifest.version || ''),
  sourceHashes,
  gate: { tests: Number(tests[1]), passed: Number(tests[2]), failed: Number(tests[3]), javascriptFiles: Number(validation[1]), runtimeSurfaces: Number(validation[2]), productionModules: Number(validation[3]) },
  smoke: { ok: smoke.ok === true, deliveryProofOk: smoke.deliveryProofOk === true, transportDrillOk: smoke.transportDrillOk === true, pilotUiOk: smoke.pilotUiOk === true, productionUiOk: smoke.productionUiOk === true, assistUiOk: smoke.assistUiOk === true, reliabilityUiOk: smoke.reliabilityUiOk === true, operationsUiOk: smoke.operationsUiOk === true, commandReachability: canonical(smoke.commandReachability), commandRegistryDigest: String(smoke.commandRegistryDigest || ''), finals: Array.isArray(smoke.finals) ? smoke.finals.length : 0, gapClear: smoke.gap?.clear === true, outboxCount: Number(smoke.outbox?.count || 0), viewports: Object.fromEntries(['desktop','mobile','tiny','print'].map(key => [key, { width: Number(smoke.pilotUi?.[key]?.viewport?.width || 0), overflow: Boolean(smoke.pilotUi?.[key]?.horizontalOverflow), accessibility: smoke.pilotUi?.[key]?.accessibility || null }])), productionViewports: Object.fromEntries(['desktop','mobile','tiny','print'].map(key => [key, { width: Number(smoke.productionUi?.[key]?.viewport?.width || 0), overflow: Boolean(smoke.productionUi?.[key]?.horizontalOverflow), controlCount: Number(smoke.productionUi?.[key]?.controlCount || 0) }])), assistViewports: Object.fromEntries(['desktop','mobile','tiny','print'].map(key => [key, { width: Number(smoke.assistUi?.[key]?.viewport?.width || 0), overflow: Boolean(smoke.assistUi?.[key]?.horizontalOverflow), controlCount: Number(smoke.assistUi?.[key]?.controlCount || 0), actionDock: smoke.assistUi?.[key]?.actionDock === true }])), operationsViewports: Object.fromEntries(['desktop','mobile','tiny','print'].map(key => [key, { width: Number(smoke.operationsUi?.[key]?.viewport?.width || 0), overflow: Boolean(smoke.operationsUi?.[key]?.horizontalOverflow), viewCount: Number(smoke.operationsUi?.[key]?.viewCount || 0), scenarioCount: Number(smoke.operationsUi?.[key]?.scenarioCount || 0), itemCount: Number(smoke.operationsUi?.[key]?.itemCount || 0), privacy: String(smoke.operationsUi?.[key]?.privacy || '') }])) },
  cleanup: { processTreeClosed: smoke.cleanup.processTreeClosed === true, profileRemoved: smoke.cleanup.profileRemoved === true, normalProfileTouched: smoke.isolatedProfile?.normalProfileTouched === true }
});
const manifestHash = digest(JSON.stringify(value));
const finalValue = { ...value, manifestHash };
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(finalValue, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, output: outputPath, commit, manifestHash, sourceCount: Object.keys(sourceHashes).length }));
