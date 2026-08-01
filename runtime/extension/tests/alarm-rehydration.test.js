import test from 'node:test';
import assert from 'node:assert/strict';
import { auditAndRehydrateAlarms } from '../shared/alarm-rehydration.js';

test('alarm audit recreates missing schedules and clears stale managed alarms', async () => {
  const created = []; const cleared = [];
  const result = await auditAndRehydrateAlarms({
    schedules: [{ alarmName: 'pmia-recovery:s1:verify:1', dueAt: 2000 }],
    existingAlarms: [{ name: 'pmia-recovery:stale:timeout:0', scheduledTime: 1500 }],
    now: 1000,
    create: async (name, options) => created.push([name, options.when]),
    clear: async name => cleared.push(name)
  });
  assert.equal(result.restored, 1);
  assert.equal(result.cleared, 1);
  assert.deepEqual(created, [['pmia-recovery:s1:verify:1', 2000]]);
  assert.deepEqual(cleared, ['pmia-recovery:stale:timeout:0']);
});