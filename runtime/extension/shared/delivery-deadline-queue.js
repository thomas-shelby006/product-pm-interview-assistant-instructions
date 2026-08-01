function clonePartition(value) {
  return {
    ...value,
    index: Math.max(0, Number(value?.index) || 0),
    memberIds: (Array.isArray(value?.memberIds) ? value.memberIds : []).map(String),
    oldestAt: Math.max(0, Number(value?.oldestAt) || 0),
    firstSeq: Math.max(0, Number(value?.firstSeq) || 0)
  };
}

export function selectDuePartition(partitions = [], {
  now = Date.now(),
  hold = false,
  active = false,
  autoSubmit = true,
  draftConflict = false,
  normalDeadlineMs = 20000,
  criticalDeadlineMs = 60000
} = {}) {
  const current = Number(now) || Date.now();
  const normal = Math.max(1, Number(normalDeadlineMs) || 20000);
  const critical = Math.max(normal, Number(criticalDeadlineMs) || 60000);
  const waiting = (Array.isArray(partitions) ? partitions : [])
    .map(clonePartition)
    .filter(partition => partition.memberIds.length)
    .map(partition => ({
      ...partition,
      deadlineAt: (partition.oldestAt || current) + normal,
      ageMs: partition.oldestAt ? Math.max(0, current - partition.oldestAt) : 0
    }))
    .sort((a, b) => a.firstSeq - b.firstSeq || a.deadlineAt - b.deadlineAt || a.index - b.index);
  const candidate = waiting[0] || null;
  let reason = 'ready';
  if (!candidate) reason = 'batch_empty';
  else if (hold) reason = 'operator_hold';
  else if (!autoSubmit) reason = 'auto_submit_disabled';
  else if (draftConflict) reason = 'draft_conflict';
  else if (active) reason = 'active_answer';
  const urgency = !candidate
    ? 'idle'
    : candidate.ageMs >= critical
      ? 'critical'
      : candidate.ageMs >= normal
        ? 'elevated'
        : 'normal';
  return {
    selected: reason === 'ready' ? candidate : null,
    waiting,
    reason,
    urgency,
    ageMs: candidate?.ageMs || 0,
    deadlineAt: candidate?.deadlineAt || 0,
    submitRecommended: reason === 'ready',
    evaluatedAt: current
  };
}
