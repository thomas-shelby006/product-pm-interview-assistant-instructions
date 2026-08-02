import test from 'node:test';
import assert from 'node:assert/strict';
import { commandForChoice, deriveOperatorChoice, validateOperatorChoice } from '../shared/operator-choice-model.js';
import { deriveOperatorDecisionCenter } from '../shared/operator-decision-center.js';

test('no-response requires an explicit choice and exposes no default command', () => {
  const snapshot={ batchState:{ pendingNoResponse:{ batchId:'b1', createdAt:10 }, next:{ batchId:'b2', memberFingerprint:'m2' } } };
  const choice=deriveOperatorChoice(snapshot,20);
  assert.equal(choice.type,'no_response');
  assert.deepEqual(choice.options,['wait','retry','continue']);
  const decision=deriveOperatorDecisionCenter(snapshot,20).primary;
  assert.equal(decision.actionMode,'choose');
  assert.equal(decision.command,'');
  assert.deepEqual(decision.payload,{});
});

test('draft conflict requires keep restore or merge selection', () => {
  const snapshot={ batchState:{ draftConflict:{ state:'unresolved', batchId:'b3', manualFingerprint:'a', pmiaFingerprint:'b' }, next:{ memberFingerprint:'m3' } } };
  const choice=deriveOperatorChoice(snapshot,20);
  assert.deepEqual(choice.options,['keep_manual','restore_pmia','merge']);
  assert.deepEqual(commandForChoice(choice.type,'merge'),{ command:'resolve_draft_merge', payload:{} });
});

test('choice validation rejects stale fingerprint and invalid option', () => {
  const snapshot={ batchState:{ pendingNoResponse:{ batchId:'b1', createdAt:10 } } };
  const choice=deriveOperatorChoice(snapshot,20);
  assert.equal(validateOperatorChoice(snapshot,{ choiceId:choice.id, fingerprint:'stale', option:'wait' },20).error,'choice_stale');
  assert.equal(validateOperatorChoice(snapshot,{ choiceId:choice.id, fingerprint:choice.fingerprint, option:'invented' },20).error,'choice_option_invalid');
  assert.equal(validateOperatorChoice(snapshot,{ choiceId:choice.id, fingerprint:choice.fingerprint, option:'retry' },20).ok,true);
});