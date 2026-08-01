import { RuntimePilotState } from '../shared/runtime-pilot-state.js';
import { SessionRegistry } from '../shared/session-registry.js';
import { auditAndRehydrateAlarms } from '../shared/alarm-rehydration.js';

function clone(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function ids(values = []) { return values.map(item => String(item?.id || item?.envelope?.id || '')).filter(Boolean); }
function owner(role) {
  return role ? [Number(role.tabId), String(role.instanceId || ''), Math.max(1, Number(role.ownerGeneration) || 1)] : null;
}
function ownerSignature(values = []) {
  return values.map(item => ({ sessionId: String(item.sessionId || ''), sender: owner(item.sender), receiver: owner(item.receiver) }));
}

export async function runRestartContinuityScenario({ state = [], outbox = [], registry = [], alarms = [] } = {}) {
  const before = clone({ state, outbox, registry, alarms });
  const pilot = new RuntimePilotState(before.state);
  const rebuiltRegistry = new SessionRegistry(before.registry);
  const afterState = pilot.exportState();
  const afterRegistry = rebuiltRegistry.exportState();
  const expectedSchedules = afterState.flatMap(session => [
    ...(session.recoverySchedules || []),
    ...(session.senderOutboxState?.retryIntent?.dueAt ? [{ alarmName: `pmia-outbox:${session.sessionId}`, dueAt: session.senderOutboxState.retryIntent.dueAt, source: 'restart_continuity' }] : [])
  ]);
  const created = [];
  const cleared = [];
  const alarmAudit = await auditAndRehydrateAlarms({
    schedules: expectedSchedules,
    existingAlarms: before.alarms,
    create: async (name, options) => created.push({ name, ...options }),
    clear: async name => cleared.push(name)
  });
  const checks = [];
  for (const session of before.state) {
    const restored = afterState.find(item => item.sessionId === session.sessionId);
    checks.push({ name: `${session.sessionId}:ledger_identity`, ok: JSON.stringify(ids(session.ledger || [])) === JSON.stringify(ids(restored?.ledger || [])) });
    checks.push({ name: `${session.sessionId}:ledger_order`, ok: (restored?.ledger || []).every((item, index, list) => index === 0 || Number(list[index - 1]?.envelope?.seq || 0) <= Number(item?.envelope?.seq || 0)) });
    checks.push({ name: `${session.sessionId}:active_batch`, ok: JSON.stringify(session.batchState?.active?.memberIds || []) === JSON.stringify(restored?.batchState?.active?.memberIds || []) });
    checks.push({ name: `${session.sessionId}:next_batch`, ok: JSON.stringify(session.batchState?.next?.memberIds || []) === JSON.stringify(restored?.batchState?.next?.memberIds || []) });
    checks.push({ name: `${session.sessionId}:ledger_index`, ok: pilot.auditLedgerIndex(session.sessionId, { repair: true }).ok === true });
    checks.push({ name: `${session.sessionId}:retry_intent`, ok: Number(session.senderOutboxState?.retryIntent?.dueAt || 0) === Number(restored?.senderOutboxState?.retryIntent?.dueAt || 0) });
    const beforeOwner = ownerSignature(before.registry).find(item => item.sessionId === session.sessionId);
    const afterOwner = ownerSignature(afterRegistry).find(item => item.sessionId === session.sessionId);
    checks.push({ name: `${session.sessionId}:owner_identity`, ok: JSON.stringify(beforeOwner || null) === JSON.stringify(afterOwner || null) });
  }
  checks.push({ name: 'owner_identity', ok: JSON.stringify(ownerSignature(before.registry)) === JSON.stringify(ownerSignature(afterRegistry)) });
  const restoredOutbox = clone(before.outbox);
  checks.push({ name: 'outbox_order', ok: JSON.stringify(ids(before.outbox)) === JSON.stringify(ids(restoredOutbox)) });
  checks.push({ name: 'alarm_rehydration', ok: alarmAudit.ok !== false });
  checks.push({ name: 'unique_ledger_ids', ok: afterState.every(item => { const values = ids(item.ledger || []); return values.length === new Set(values).size; }) });
  return { ok: checks.every(check => check.ok), before, after: { state: afterState, outbox: before.outbox, registry: afterRegistry, alarms: before.alarms, createdAlarms: created.length, createdAlarmNames: created.map(item => item.name), clearedAlarms: cleared.length, clearedAlarmNames: cleared }, checks };
}
