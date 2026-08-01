export function deriveStartupDeadlineCatchup({ schedules = [], now = Date.now(), generation = 0 } = {}) {
  const current = Math.max(0, Number(generation || 0));
  const overdue = [];
  const future = [];
  for (const item of Array.isArray(schedules) ? schedules : []) {
    const value = { ...item, dueAt: Math.max(0, Number(item.dueAt || 0)), generation: Math.max(0, Number(item.generation || 0)) };
    if (value.generation !== current) continue;
    (value.dueAt <= now ? overdue : future).push(value);
  }
  overdue.sort((a, b) => a.dueAt - b.dueAt || String(a.kind).localeCompare(String(b.kind)));
  future.sort((a, b) => a.dueAt - b.dueAt);
  return { overdue, future, actions: overdue.map(item => ({ sessionId: item.sessionId, kind: item.kind, source: 'startup_deadline_catchup', dueAt: item.dueAt, generation: item.generation })) };
}
