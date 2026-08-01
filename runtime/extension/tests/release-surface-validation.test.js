import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const validator = await readFile(new URL('../scripts/validate-extension.mjs', import.meta.url), 'utf8');
const gate = await readFile(new URL('../../Validate_Extension_Runtime.ps1', import.meta.url), 'utf8');
const protocol = await readFile(new URL('../shared/dashboard-protocol.js', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8');
const markup = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');

test('production validation excludes and forbids test-only fault modules', () => {
  assert.match(validator, /!path\.startsWith\('testing'\)/);
  assert.match(validator, /Production module imports test-only fault harness/);
  assert.match(validator, /Unreachable production JavaScript modules/);
});

test('complete gate discovers the deterministic release evidence builder', () => {
  assert.match(gate, /build-release-evidence-manifest\.mjs/);
  assert.match(gate, /GateLog, SmokeEvidence, and EvidenceManifest must be provided together/);
  assert.match(gate, /Release evidence manifest generation failed/);
});

test('safe support bundle is a first-class accessible dashboard action', () => {
  assert.match(protocol, /'export_support_bundle'/);
  assert.match(markup, /id="exportSupportBundle"/);
  assert.match(markup, /Safe support bundle/);
  assert.match(dashboard, /sendCommand\('export_support_bundle'\)/);
  assert.match(dashboard, /Metadata-only support bundle exported/);
});
