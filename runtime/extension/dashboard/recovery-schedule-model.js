export function deriveRecoverySchedule(snapshot, now = Date.now()) {
  const schedules = (Array.isArray(snapshot?.recoverySchedules) ? snapshot.recoverySchedules : [])
    .filter(value => Number(value?.dueAt || 0) > 0)
    .sort((a, b) => Number(a.dueAt) - Number(b.dueAt));
  const next = schedules[0] || null;
  return {
    scheduled: Boolean(next),
    count: schedules.length,
    kind: String(next?.kind || ''),
    dueAt: Number(next?.dueAt || 0),
    dueInMs: next ? Math.max(0, Number(next.dueAt) - Number(now)) : 0,
    source: String(next?.source || ''),
    attempt: Math.max(0, Number(next?.attempt || 0))
  };
}
