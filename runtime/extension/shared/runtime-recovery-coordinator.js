import { createRepairEventCoalescer } from './repair-event-coalescer.js';
import { transitionRecovery } from './recovery-state-machine.js';
import { clearRecoveryAlarms, parseRecoveryAlarmName, scheduleRecoveryAlarm } from './recovery-schedule.js';

export function createRuntimeRecoveryCoordinator({
  chromeApi = globalThis.chrome,
  now = Date.now,
  cooldownMs = 1000
} = {}) {
  const coalescer = createRepairEventCoalescer({ cooldownMs });

  function persistReport(pilot, sessionId, report, at = now()) {
    const decision = coalescer.accept(sessionId, report, at);
    pilot.setRepair(sessionId, decision.report, at, { record: decision.persist });
    return decision.report;
  }

  function applyTransition(pilot, sessionId, event) {
    const previous = pilot.snapshot(sessionId)?.lastRepair || null;
    const next = transitionRecovery(previous, event, now());
    const report = JSON.stringify(previous) !== JSON.stringify(next)
      ? persistReport(pilot, sessionId, next)
      : next;
    const mode = report.phase === 'healthy' ? 'active' : report.phase;
    if (pilot.snapshot(sessionId)?.mode !== mode) pilot.setMode(sessionId, mode);
    return report;
  }

  async function scheduleVerification(sessionId, pilot, attempt = 0) {
    if (attempt >= 4) return false;
    const schedule = await scheduleRecoveryAlarm(chromeApi, {
      sessionId,
      kind: 'verify',
      attempt,
      delayMs: Math.min(8000, 1200 * (2 ** attempt)),
      now: now(),
      source: 'repair_verification'
    });
    pilot.upsertRecoverySchedule(sessionId, schedule);
    return schedule;
  }

  async function scheduleTimeout(sessionId, pilot) {
    const schedule = await scheduleRecoveryAlarm(chromeApi, {
      sessionId,
      kind: 'timeout',
      attempt: 0,
      delayMs: 30000,
      now: now(),
      source: 'repair_timeout'
    });
    pilot.upsertRecoverySchedule(sessionId, schedule);
    return schedule;
  }

  async function cancelSchedules(sessionId, pilot) {
    const schedules = pilot.clearRecoverySchedules(sessionId);
    await clearRecoveryAlarms(chromeApi, schedules);
    return schedules.length;
  }

  function alarmIdentity(alarm) {
    return parseRecoveryAlarmName(alarm?.name);
  }

  function inspectAlarm(pilot, alarm) {
    const identity = alarmIdentity(alarm);
    if (!identity) return { ok: false, ignored: true, reason: 'unrelated_alarm', identity: null };
    const snapshot = pilot.snapshot(identity.sessionId);
    const scheduled = snapshot?.recoverySchedules?.find(value => value.alarmName === identity.alarmName);
    if (!scheduled) return { ok: true, ignored: true, reason: 'stale_alarm', identity };
    pilot.removeRecoverySchedule(identity.sessionId, identity.alarmName);
    return { ok: true, ignored: false, reason: '', identity, snapshot };
  }

  function clear(sessionId) {
    coalescer.clear(sessionId);
  }

  return {
    applyTransition,
    persistReport,
    scheduleVerification,
    scheduleTimeout,
    cancelSchedules,
    alarmIdentity,
    inspectAlarm,
    clear
  };
}