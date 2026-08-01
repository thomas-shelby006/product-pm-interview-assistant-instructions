import test from 'node:test';
import assert from 'node:assert/strict';
import { runConsistencyAudit } from '../shared/consistency-watchdog.js';

test('consistency watchdog detects repairable ownership and alarm gaps without changing state', () => {
  const registry = { getSession: () => ({ sender: null, receiver: { tabId: 2 } }) };
  const audit = runConsistencyAudit({
    snapshot: { sessionId: 's1', sender: { connected: true }, receiver: { connected: true }, recoverySchedules: [{ alarmName: 'a1' }] },
    registry,
    alarms: []
  });
  assert.equal(audit.ok, true);
  assert.ok(audit.repairs.some(item => item.code === 're_register_role' && item.role === 'sender'));
  assert.ok(audit.repairs.some(item => item.code === 'restore_alarm'));
});

test('ambiguous batch membership blocks automatic repair', () => {
  const audit = runConsistencyAudit({ snapshot: { sessionId: 's1', batchState: { active: { memberIds: ['q1'] }, next: { memberIds: ['q1'] } } } });
  assert.equal(audit.ok, false);
  assert.equal(audit.blocked[0].code, 'ambiguous_batch_membership');
});
