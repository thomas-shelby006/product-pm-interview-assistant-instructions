const ACTIONS = Object.freeze({
  state_compatibility: 'operator_handoff',
  storage_critical: 'queue_only',
  registration_missing: 'managed_reload',
  transport_unavailable: 'reconnect',
  provider_capability_blocked: 're_register',
  sequence_gap: 'reconcile',
  batch_conflict: 'operator_handoff',
  proof_failed: 'reconcile',
  healthy: 'none'
});

export function selectRecoveryAction(rootCause = {}, { budget = {}, attempts = 0, roleHealth = {} } = {}) {
  const code = String(rootCause.code || 'unknown');
  const planned = ACTIONS[code] || 'operator_handoff';
  const remaining = Math.max(0, Number(budget.remaining ?? budget.maxAutomatic ?? 0));
  if (planned === 'none') return { action: 'none', automatic: false, reason: 'runtime_healthy' };
  if (['operator_handoff','queue_only'].includes(planned)) return { action: planned, automatic: false, reason: code };
  if (remaining <= 0 || Number(attempts) >= 3) return { action: 'operator_handoff', automatic: false, reason: 'recovery_budget_exhausted' };
  if (planned === 'managed_reload' && roleHealth?.activeAnswer) return { action: 'reconnect', automatic: true, reason: 'active_answer_preserved' };
  return { action: planned, automatic: true, reason: code };
}
