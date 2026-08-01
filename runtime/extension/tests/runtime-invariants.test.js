import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntimeState } from '../shared/runtime-invariants.js';

test('runtime invariant validator repairs deterministic duplicate schedules and ledger identities', () => {
  const result = validateRuntimeState([{ sessionId: 's1', ledger: [{ id: 'q1' }, { id: 'q1' }], recoverySchedules: [{ alarmName: 'a' }, { alarmName: 'a' }] }]);
  assert.equal(result.repaired, 2);
  assert.equal(result.state[0].ledger.length, 1);
  assert.equal(result.state[0].recoverySchedules.length, 1);
});

test('runtime invariant validator blocks ambiguous batch membership without deleting it', () => {
  const result = validateRuntimeState([{ sessionId: 's1', ledger: [{ id: 'q1' }], batchState: { active: { memberIds: ['missing'] } } }]);
  assert.equal(result.blocked, 1);
  assert.equal(result.state[0].batchState.active.memberIds[0], 'missing');
});