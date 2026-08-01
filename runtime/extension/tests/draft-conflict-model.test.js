import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDraftConflict } from '../dashboard/draft-conflict-model.js';

test('draft conflict model distinguishes unresolved and acknowledged manual states', () => {
  const unresolved = deriveDraftConflict({ batchState: { draftConflict: { owner: 'batch', state: 'unresolved', at: 10 } } });
  assert.equal(unresolved.visible, true);
  assert.equal(unresolved.state, 'unresolved');
  const manual = deriveDraftConflict({ batchState: { draftConflict: { owner: 'manual', state: 'keep_manual', at: 10 } } });
  assert.equal(manual.label, 'Manual draft kept');
});
