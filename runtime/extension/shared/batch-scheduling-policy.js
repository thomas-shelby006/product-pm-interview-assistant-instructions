export function deriveBatchSchedulingDecision({
  memberIds = [],
  oldestAt = 0,
  now = Date.now(),
  hold = false,
  autoSubmit = true,
  receiverBusy = false,
  draftConflict = false
} = {}) {
  const ids = (Array.isArray(memberIds) ? memberIds : []).map(String);
  const ageMs = oldestAt ? Math.max(0, Number(now) - Number(oldestAt)) : 0;
  const urgency = ageMs >= 60000 ? 'critical' : ageMs >= 20000 ? 'elevated' : ids.length ? 'normal' : 'idle';
  let reason = 'ready';
  if (!ids.length) reason = 'batch_empty';
  else if (hold) reason = 'operator_hold';
  else if (!autoSubmit) reason = 'auto_submit_disabled';
  else if (draftConflict) reason = 'draft_conflict';
  else if (receiverBusy) reason = 'receiver_busy';
  return {
    memberIds: ids,
    ageMs,
    urgency,
    reason,
    submitRecommended: reason === 'ready',
    evaluatedAt: Number(now)
  };
}