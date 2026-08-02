import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPolicyImpactPreview, validatePolicyImpactConfirmation } from '../shared/policy-impact-preview.js';

function snapshot() {
  return { sessionId:'s1', mode:'active', ledgerCounts:{ pending:2, inFlight:1 }, batchState:{ autoSubmit:false, hold:true, receiverPolicy:{ pauseAfterAnswer:true, submitOnIdle:false, drainMode:'off' } }, deliveryPolicy:{ active:false, allowProviderWrite:true }, storagePressure:{ level:'normal' }, selfTest:{ ok:true }, receiver:{ adapterCapabilityProbation:{ writeSafe:true } }, productionControls:{ operatingProfile:'safe' } };
}

test('Fast profile preview describes provider writes and protected impact', () => {
  const preview=buildPolicyImpactPreview(snapshot(),{ kind:'operating_profile', profile:'fast' },100);
  assert.equal(preview.allowed,true);
  assert.equal(preview.protectedCount,3);
  assert.equal(preview.providerWrites,'may_start');
  assert.equal(preview.postAnswer,'drain_all');
  assert.equal(preview.risk,'caution');
});

test('policy confirmation rejects changed backlog and expiry', () => {
  const value=snapshot();
  const preview=buildPolicyImpactPreview(value,{ kind:'operating_profile', profile:'balanced' },100);
  assert.equal(validatePolicyImpactConfirmation(value,preview,110).ok,true);
  const changed={ ...value, ledgerCounts:{ pending:3, inFlight:1 } };
  assert.equal(validatePolicyImpactConfirmation(changed,preview,110).error,'policy_preview_stale');
  assert.equal(validatePolicyImpactConfirmation(value,preview,40_101).error,'policy_preview_expired');
});

test('hard containment cannot be preview-confirmed as an override', () => {
  const value={ ...snapshot(), mode:'blocked', deliveryPolicy:{ active:true, reason:'state_incompatible', allowProviderWrite:false } };
  const preview=buildPolicyImpactPreview(value,{ kind:'containment_override', enabled:true },100);
  assert.equal(preview.allowed,false);
  assert.deepEqual(preview.blockers,['hard_containment']);
  assert.equal(validatePolicyImpactConfirmation(value,preview,101).error,'policy_preview_blocked');
});