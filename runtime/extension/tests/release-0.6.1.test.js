import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(extensionRoot, '..', '..');
const read = path => readFile(resolve(repoRoot, path), 'utf8');

test('historical PMIA 0.6.1 verification evidence remains preserved', async () => {
  const evidence = await read('docs/evidence/2026-07-30-pmia-runtime-v0.6.1-verification.md');
  assert.match(evidence, /PMIA Runtime v0\.6\.1 Verification/);
  assert.match(evidence, /303 passed, 0 failed/);
  assert.match(evidence, /pmia-runtime-v0\.6\.1/);
});

test('completed 0.6.1 migration records remain historical, not current setup instructions', async () => {
  const phase = await read('AHK_PHASE_2_IMPLEMENTATION_PLAN.md');
  const design = await read('docs/superpowers/specs/2026-07-30-pmia-final-architecture-design.md');
  assert.match(phase, /Status: completed in PMIA runtime 0\.6\.1/i);
  assert.match(design, /Manifest V3/);
  assert.match(design, /Legacy Tampermonkey/);
});