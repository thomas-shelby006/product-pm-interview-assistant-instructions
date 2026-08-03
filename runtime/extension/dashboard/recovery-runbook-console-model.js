import { deriveRecoveryProgress } from './recovery-progress-model.js';

function recoveryBudgetModel(budget = {}, recovery = {}) {
  const used = Math.max(0, Number(
    budget.automaticUsed ?? budget.used ?? recovery.attempt ?? 0
  ));
  const max = Math.max(0, Number(
    budget.maxAutomatic ?? budget.max ?? 3
  ));
  return {
    used,
    max,
    remaining: Math.max(0, max - used)
  };
}

export function deriveRecoveryRunbookConsole(snapshot = {}, now = Date.now()) {
  const progress = deriveRecoveryProgress(snapshot);
  const schedule = snapshot.recoverySchedules?.[0] || null;
  const budget = snapshot.recoveryBudget || {};
  const recovery = snapshot.lastRepair || {};
  const retryBudget = recoveryBudgetModel(budget, recovery);
  const byId = Object.fromEntries(
    (progress.items || []).map(item => [item.id, item.complete])
  );
  const steps = [
    { id: 'roles', label: 'Managed roles', complete: Boolean(byId.sender && byId.receiver) },
    { id: 'adapters', label: 'Provider adapters', complete: Boolean(byId.adapters) },
    { id: 'reconciliation', label: 'Lossless reconciliation', complete: Boolean(byId.reconciliation) },
    { id: 'storage', label: 'Session storage', complete: Boolean(byId.storage) }
  ];
  const current = steps.find(item => !item.complete) || null;
  const command = snapshot.mode === 'blocked'
    ? 'repair_runtime'
    : current?.id === 'reconciliation'
      ? 'resume_catch_up'
      : current
        ? 'check_live'
        : snapshot.selfTest?.ok
          ? ''
          : 'run_self_test';
  const automaticAllowed = budget.state !== 'exhausted'
    && retryBudget.remaining > 0
    && !snapshot.deliveryPolicy?.active
    && snapshot.storagePressure?.level !== 'critical';

  return {
    state: String(snapshot.mode || 'unknown'),
    steps,
    complete: steps.filter(item => item.complete).length,
    total: steps.length,
    current,
    retryBudget,
    deadline: schedule ? {
      kind: schedule.kind,
      dueInMs: Math.max(0, Number(schedule.dueAt || 0) - now)
    } : null,
    automaticAllowed,
    command,
    reason: String(snapshot.rootCause?.code || recovery.reason || 'healthy')
  };
}
