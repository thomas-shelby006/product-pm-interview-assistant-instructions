import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRecoverySchedule } from '../dashboard/recovery-schedule-model.js';

test('recovery schedule model selects the nearest persisted deadline', () => {
  const view = deriveRecoverySchedule({ recoverySchedules: [
    { kind: 'timeout', dueAt: 40000, source: 'repair' },
    { kind: 'verify', dueAt: 12000, source: 'repair' }
  ] }, 10000);
  assert.equal(view.kind, 'verify');
  assert.equal(view.dueInMs, 2000);
});
