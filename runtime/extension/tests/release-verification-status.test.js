import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveReleaseVerificationStatus } from '../../scripts/release-verification-status.mjs';

const deterministicPass = {
  selfTest: true,
  adaptiveTurnScenarios: true,
  transportDrill: true,
  pilotUi: true,
  productionUi: true,
  assistUi: true,
  reliabilityUi: true,
  operationsUi: true
};

test('provider limitation does not erase a deterministic browser pass', () => {
  const result = deriveReleaseVerificationStatus({
    deterministic: deterministicPass,
    providerCanary: { status: 'limited', reason: 'rendered_turn_not_confirmed' }
  });
  assert.equal(result.deterministicBrowser.ok, true);
  assert.equal(result.providerCanary.status, 'limited');
  assert.equal(result.packageReady, true);
  assert.equal(result.activationReady, false);
  assert.equal(result.status, 'provider_limited');
});

test('deterministic browser failure blocks package readiness even when provider passes', () => {
  const result = deriveReleaseVerificationStatus({
    deterministic: { ...deterministicPass, transportDrill: false },
    providerCanary: { status: 'passed', reason: '' },
    normalProfileActivation: { ok: true }
  });
  assert.equal(result.deterministicBrowser.ok, false);
  assert.equal(result.packageReady, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.status, 'deterministic_failed');
});

test('activation requires package readiness, provider pass, and normal-profile proof', () => {
  const result = deriveReleaseVerificationStatus({
    deterministic: deterministicPass,
    providerCanary: { status: 'passed', reason: '' },
    normalProfileActivation: { ok: true }
  });
  assert.equal(result.packageReady, true);
  assert.equal(result.activationReady, true);
  assert.equal(result.status, 'ready');
});