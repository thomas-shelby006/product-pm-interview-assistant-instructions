import test from 'node:test';
import assert from 'node:assert/strict';
import { explainFault, faultCatalog, searchFaultCatalog } from '../shared/fault-catalog.js';
import { createReproducibilitySeed, createSeededRandom, seededShuffle } from '../shared/reproducibility-seed.js';
import { auditReasonCodeRegistry, reasonCode, registerReasonCodes } from '../shared/reason-code-registry.js';
import { buildArchitectureBudgetReport } from '../shared/architecture-budget-report.js';
import { buildReleaseIdentity, validateReleaseIdentity } from '../shared/release-identity.js';

test('Cycle 191: searchable fault catalog returns owner action and fallback explanation', () => {
  assert.equal(faultCatalog().length >= 8, true);
  assert.equal(searchFaultCatalog('sequence')[0].code, 'sequence_gap');
  assert.equal(explainFault('unknown').action, 'export_support_bundle');
});

test('Cycle 192: reproducibility seed makes shuffle and random streams deterministic', () => {
  const seed = createReproducibilitySeed('session');
  const first = createSeededRandom(seed.seed); const second = createSeededRandom(seed.seed);
  assert.equal(first(), second());
  assert.deepEqual(seededShuffle([1,2,3,4], seed.seed), seededShuffle([1,2,3,4], seed.seed));
});

test('Cycle 193: reason registry rejects collisions and reports unknown event codes', () => {
  assert.equal(registerReasonCodes('delivery', [{ code: 'proof_missing', severity: 'warn' }]).ok, true);
  assert.equal(registerReasonCodes('other', [{ code: 'proof_missing' }]).error, 'reason_code_collision');
  assert.equal(reasonCode('proof_missing').owner, 'delivery');
  assert.deepEqual(auditReasonCodeRegistry([{ reason: 'proof_missing' }, { reason: 'new_unknown' }]).unknown, ['new_unknown']);
});

test('Cycle 194: architecture budget reports line and import violations by owner', () => {
  const report = buildArchitectureBudgetReport({ modules: [{ path: 'controller.js', lines: 2300, imports: 10, owner: 'controller' }, { path: 'small.js', lines: 100, imports: 30, owner: 'shared' }] });
  assert.equal(report.ok, false);
  assert.equal(report.violations.some(item => item.code === 'module_line_budget'), true);
  assert.equal(report.violations.some(item => item.code === 'module_import_budget'), true);
});

test('Cycle 195: release identity requires 0.9 commit manifest and evidence hashes', async () => {
  const identity = buildReleaseIdentity({ version: '0.10.3', commit: 'abc', manifestHash: 'm', evidenceHash: 'e', builtAt: 10 });
  assert.equal(validateReleaseIdentity(identity).ok, true);
  assert.equal(validateReleaseIdentity({ ...identity, version: '0.7.0' }).ok, false);
  const { readFile } = await import('node:fs/promises');
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.version, '0.10.3');
});

test('mechanics hardening report imports every Cycle 171-195 owner', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../shared/mechanics-hardening-report.js', import.meta.url), 'utf8');
  for (const name of ['prerender-guard','runtime-injection-fence','wake-history','selector-probe-registry','partial-proof-report','durable-tombstones','fair-batch-scheduler','cleanup-transaction-journal','fault-catalog','architecture-budget-report','architecture-boundary-audit','release-identity']) assert.match(source, new RegExp(name));
});
