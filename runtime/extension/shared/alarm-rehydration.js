function managedAlarm(name) {
  return /^pmia-(?:recovery|outbox):/.test(String(name || ''));
}

export function normalizeAlarmSchedule(value, now = Date.now()) {
  const alarmName = String(value?.alarmName || value?.name || '').trim();
  const dueAt = Math.max(0, Number(value?.dueAt || value?.scheduledTime) || 0);
  if (!alarmName || !managedAlarm(alarmName) || !dueAt) return null;
  return { alarmName, dueAt: Math.max(Number(now) + 50, dueAt), source: String(value?.source || 'persisted') };
}

export async function auditAndRehydrateAlarms({
  schedules = [],
  existingAlarms = [],
  now = Date.now(),
  create = async () => {},
  clear = async () => {}
} = {}) {
  const expected = new Map((Array.isArray(schedules) ? schedules : [])
    .map(value => normalizeAlarmSchedule(value, now))
    .filter(Boolean)
    .map(value => [value.alarmName, value]));
  const existing = new Map((Array.isArray(existingAlarms) ? existingAlarms : [])
    .filter(value => managedAlarm(value?.name))
    .map(value => [String(value.name), value]));
  let restored = 0; let unchanged = 0; let cleared = 0;
  for (const [name, schedule] of expected) {
    const current = existing.get(name);
    if (current && Math.abs(Number(current.scheduledTime || 0) - schedule.dueAt) < 1000) {
      unchanged += 1;
      continue;
    }
    await create(name, { when: schedule.dueAt });
    restored += 1;
  }
  for (const name of existing.keys()) {
    if (expected.has(name)) continue;
    await clear(name);
    cleared += 1;
  }
  return { restored, unchanged, cleared, expected: expected.size, auditedAt: Number(now) };
}

export function outboxAlarmName(sessionId) {
  return `pmia-outbox:${String(sessionId || '')}`;
}