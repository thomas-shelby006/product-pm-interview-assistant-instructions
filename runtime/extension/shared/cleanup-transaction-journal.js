const STEPS = Object.freeze(['freeze_commands','export_optional','clear_registry','clear_pilot','clear_logs','close_windows','remove_profile','verify_cleanup']);

export function beginCleanupTransaction({ sessionId = '', now = Date.now(), id = '' } = {}) {
  return { id: String(id || `cleanup-${sessionId}-${now}`), sessionId: String(sessionId), state: 'running', current: 0, steps: STEPS.map(name => ({ name, state: 'pending', at: 0, error: '' })), startedAt: now, completedAt: 0 };
}

export function recordCleanupStep(transaction = {}, name = '', result = {}, now = Date.now()) {
  const value = JSON.parse(JSON.stringify(transaction));
  const index = value.steps?.findIndex(step => step.name === name) ?? -1;
  if (index < 0) return { ok: false, error: 'cleanup_step_unknown', transaction: value };
  value.steps[index] = { ...value.steps[index], state: result?.ok === false ? 'failed' : 'complete', at: now, error: result?.ok === false ? String(result.error || 'cleanup_failed') : '' };
  value.current = Math.max(value.current || 0, index + 1);
  if (result?.ok === false) value.state = 'failed';
  else if (value.steps.every(step => step.state === 'complete')) { value.state = 'complete'; value.completedAt = now; }
  return { ok: result?.ok !== false, transaction: value };
}

export function resumeCleanupTransaction(transaction = {}) {
  const next = (transaction.steps || []).find(step => step.state !== 'complete');
  return { resumable: transaction.state !== 'complete' && Boolean(next), nextStep: next?.name || '', transaction: JSON.parse(JSON.stringify(transaction)) };
}
