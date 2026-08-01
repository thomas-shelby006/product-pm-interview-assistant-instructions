const DRAIN_MODES = new Set(['off', 'one', 'all']);

export function normalizeReceiverDeliveryPolicy(value = {}) {
  return {
    pauseAfterAnswer: Boolean(value.pauseAfterAnswer),
    drainMode: DRAIN_MODES.has(String(value.drainMode)) ? String(value.drainMode) : 'off',
    submitOnIdle: Boolean(value.submitOnIdle),
    drainRemaining: Math.max(0, Number(value.drainRemaining || 0)),
    updatedAt: Math.max(0, Number(value.updatedAt || 0))
  };
}

export function updateReceiverDeliveryPolicy(current = {}, patch = {}, now = Date.now()) {
  const next = normalizeReceiverDeliveryPolicy({ ...current, ...patch, updatedAt: now });
  if (next.drainMode === 'one' && !next.drainRemaining) next.drainRemaining = 1;
  if (next.drainMode === 'off') next.drainRemaining = 0;
  return next;
}

export function postAnswerDecision(policy = {}, context = {}) {
  const value = normalizeReceiverDeliveryPolicy(policy);
  const nextCount = Math.max(0, Number(context.nextCount || 0));
  const answerState = String(context.answerState || 'complete');
  if (answerState === 'no_response') return { action: 'await_resolution', reason: 'no_response', nextPolicy: value };
  if (value.pauseAfterAnswer) return { action: 'pause', reason: 'pause_after_answer', nextPolicy: value };
  if (!nextCount) return { action: 'idle', reason: 'caught_up', nextPolicy: value };
  if (value.drainMode === 'one') {
    const remaining = Math.max(0, value.drainRemaining - 1);
    return {
      action: remaining >= 0 && value.drainRemaining > 0 ? 'submit_next' : 'pause',
      reason: value.drainRemaining > 0 ? 'drain_one' : 'drain_complete',
      nextPolicy: { ...value, drainRemaining: remaining, drainMode: remaining ? 'one' : 'off' }
    };
  }
  if (value.drainMode === 'all') return { action: 'submit_next', reason: 'drain_all', nextPolicy: value };
  if (value.submitOnIdle) return { action: 'submit_next', reason: 'submit_on_idle', nextPolicy: value };
  return { action: 'default', reason: 'auto_submit_policy', nextPolicy: value };
}
