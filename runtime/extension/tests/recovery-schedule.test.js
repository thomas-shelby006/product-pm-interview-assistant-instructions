import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecoveryAlarmName, recoveryAlarmName, scheduleRecoveryAlarm } from '../shared/recovery-schedule.js';

test('recovery alarm identity round trips session kind and attempt', () => {
  const name = recoveryAlarmName('session:a', 'verify', 2);
  assert.deepEqual(parseRecoveryAlarmName(name), { sessionId: 'session:a', kind: 'verify', attempt: 2, alarmName: name });
});

test('recovery alarm schedules an absolute deadline without provider focus', async () => {
  const calls = [];
  const chromeApi = { alarms: { create: async (name, info) => calls.push({ name, info }) } };
  const result = await scheduleRecoveryAlarm(chromeApi, { sessionId: 's', kind: 'timeout', attempt: 0, delayMs: 30000, now: 1000, source: 'repair' });
  assert.equal(result.dueAt, 31000);
  assert.equal(calls[0].info.when, 31000);
});
