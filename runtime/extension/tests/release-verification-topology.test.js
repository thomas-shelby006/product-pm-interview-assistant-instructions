import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const topologyPath = path.join(root, 'runtime/scripts/release-verification-topology.json');

function topology() {
  return JSON.parse(fs.readFileSync(topologyPath, 'utf8'));
}

test('release verification topology exposes four independent authority lanes', () => {
  const value = topology();
  assert.equal(value.format, 'pmia-release-verification-topology/v1');
  assert.deepEqual(Object.keys(value.lanes).sort(), [
    'deterministicBrowser', 'normalProfileActivation', 'providerCanary', 'sourcePackage'
  ]);
  assert.equal(value.lanes.sourcePackage.blocksPackage, true);
  assert.equal(value.lanes.deterministicBrowser.blocksPackage, true);
  assert.equal(value.lanes.providerCanary.blocksPackage, false);
  assert.equal(value.lanes.normalProfileActivation.blocksActivation, true);
  assert.equal(value.lanes.normalProfileActivation.manualBoundary, true);
});

test('provider canary cannot be promoted into deterministic browser success', () => {
  const value = topology();
  assert.notEqual(value.lanes.providerCanary.authority, value.lanes.deterministicBrowser.authority);
  assert.equal(value.lanes.providerCanary.successEvidence, 'provider_rendered_turn');
  assert.equal(value.lanes.deterministicBrowser.successEvidence, 'extension_runtime_and_ui');
  assert.match(value.rules.join('\n'), /never satisfy deterministic browser/i);
});