import test from 'node:test';
import assert from 'node:assert/strict';
import { runRestartContinuityScenario } from '../testing/restart-continuity-scenario.js';

test('restart continuity preserves session owner retry and alarm identity through JSON reconstruction', async () => {
  const state = [{
    sessionId: 's1',
    ledger: [],
    senderOutboxState: { count: 1, retryIntent: { dueAt: 5000 } },
    recoverySchedules: [{ alarmName: 'pmia-recovery:s1:verify:0', dueAt: 6000 }]
  }];
  const registry = [{
    sessionId: 's1',
    sender: { sessionId: 's1', role: 'sender', provider: 'chatgpt', tabId: 1, instanceId: 'i1', registeredAt: 1 },
    receiver: { sessionId: 's1', role: 'receiver', provider: 'chatgpt', tabId: 2, instanceId: 'i2', registeredAt: 1 }
  }];
  const result = await runRestartContinuityScenario({ state, registry, alarms: [] });
  assert.equal(result.ok, true);
  assert.ok(result.checks.some(check => check.name === 's1:owner_identity' && check.ok));
  assert.ok(result.after.createdAlarms >= 1);
});
