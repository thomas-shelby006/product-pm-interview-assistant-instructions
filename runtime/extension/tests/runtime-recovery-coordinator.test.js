import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeRecoveryCoordinator } from '../shared/runtime-recovery-coordinator.js';

function pilot() {
  const sessions = new Map([['s', { mode: 'active', lastRepair: null, recoverySchedules: [] }]]);
  return {
    snapshot(id) { const value = sessions.get(id); return value ? structuredClone(value) : null; },
    setRepair(id, report, _now, { record } = {}) { const value = sessions.get(id); value.lastRepair = { ...report }; value.recorded = Boolean(record); },
    setMode(id, mode) { sessions.get(id).mode = mode; },
    upsertRecoverySchedule(id, schedule) { sessions.get(id).recoverySchedules = sessions.get(id).recoverySchedules.filter(x => x.kind !== schedule.kind); sessions.get(id).recoverySchedules.push(schedule); },
    clearRecoverySchedules(id) { const value = sessions.get(id); const old = value.recoverySchedules; value.recoverySchedules = []; return old; },
    removeRecoverySchedule(id, name) { const value = sessions.get(id); value.recoverySchedules = value.recoverySchedules.filter(x => x.alarmName !== name); }
  };
}

function chromeApi() {
  const created = [];
  const cleared = [];
  return { created, cleared, alarms: { async create(name, spec) { created.push([name, spec]); }, async clear(name) { cleared.push(name); return true; } } };
}

test('coordinator persists semantic recovery transition and mode', () => {
  const p = pilot();
  const coordinator = createRuntimeRecoveryCoordinator({ chromeApi: chromeApi(), now: () => 1000 });
  const report = coordinator.applyTransition(p, 's', { type: 'repair_requested' });
  assert.equal(report.phase, 'repairing');
  assert.equal(p.snapshot('s').mode, 'repairing');
  assert.equal(p.snapshot('s').recorded, true);
});

test('coordinator schedules and cancels durable recovery alarms', async () => {
  const p = pilot();
  const api = chromeApi();
  const coordinator = createRuntimeRecoveryCoordinator({ chromeApi: api, now: () => 1000 });
  await coordinator.scheduleVerification('s', p, 1);
  await coordinator.scheduleTimeout('s', p);
  assert.equal(p.snapshot('s').recoverySchedules.length, 2);
  assert.equal(api.created.length, 2);
  assert.equal(await coordinator.cancelSchedules('s', p), 2);
  assert.equal(api.cleared.length, 2);
});

test('coordinator rejects unrelated and stale alarms', () => {
  const p = pilot();
  const coordinator = createRuntimeRecoveryCoordinator({ chromeApi: chromeApi() });
  assert.equal(coordinator.inspectAlarm(p, { name: 'other' }).reason, 'unrelated_alarm');
  assert.equal(coordinator.inspectAlarm(p, { name: 'pmia-recovery:verify:0:s' }).reason, 'stale_alarm');
});

test('coordinator accepts current alarm and removes its persisted schedule', async () => {
  const p = pilot();
  const coordinator = createRuntimeRecoveryCoordinator({ chromeApi: chromeApi(), now: () => 1000 });
  const schedule = await coordinator.scheduleVerification('s', p, 0);
  const decision = coordinator.inspectAlarm(p, { name: schedule.alarmName });
  assert.equal(decision.ok, true);
  assert.equal(decision.identity.sessionId, 's');
  assert.equal(p.snapshot('s').recoverySchedules.length, 0);
});