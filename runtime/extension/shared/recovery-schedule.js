const PREFIX = 'pmia-recovery:';
const KINDS = new Set(['verify', 'timeout']);

export function recoveryAlarmName(sessionId, kind, attempt = 0) {
  const normalizedSession = String(sessionId || '').trim();
  const normalizedKind = String(kind || '').trim();
  if (!normalizedSession || !KINDS.has(normalizedKind)) throw new TypeError('Invalid recovery alarm identity');
  return `${PREFIX}${normalizedKind}:${Math.max(0, Number(attempt) || 0)}:${encodeURIComponent(normalizedSession)}`;
}

export function parseRecoveryAlarmName(name) {
  const value = String(name || '');
  if (!value.startsWith(PREFIX)) return null;
  const rest = value.slice(PREFIX.length);
  const first = rest.indexOf(':');
  const second = rest.indexOf(':', first + 1);
  if (first < 1 || second < 0) return null;
  const kind = rest.slice(0, first);
  const attempt = Number(rest.slice(first + 1, second));
  if (!KINDS.has(kind) || !Number.isSafeInteger(attempt) || attempt < 0) return null;
  let sessionId = '';
  try { sessionId = decodeURIComponent(rest.slice(second + 1)); } catch { return null; }
  if (!sessionId) return null;
  return { sessionId, kind, attempt, alarmName: value };
}

export async function scheduleRecoveryAlarm(chromeApi, {
  sessionId,
  kind,
  attempt = 0,
  delayMs,
  now = Date.now(),
  source = 'recovery'
} = {}) {
  if (!chromeApi?.alarms?.create) throw new Error('alarms_unavailable');
  const alarmName = recoveryAlarmName(sessionId, kind, attempt);
  const dueAt = Number(now) + Math.max(100, Number(delayMs) || 0);
  await chromeApi.alarms.create(alarmName, { when: dueAt });
  return { alarmName, sessionId: String(sessionId), kind, attempt: Math.max(0, Number(attempt) || 0), dueAt, source: String(source || 'recovery'), updatedAt: Number(now) };
}

export async function clearRecoveryAlarms(chromeApi, schedules = []) {
  const results = [];
  for (const schedule of Array.isArray(schedules) ? schedules : []) {
    const name = String(schedule?.alarmName || '');
    if (!name) continue;
    try { results.push(await chromeApi?.alarms?.clear?.(name)); } catch { results.push(false); }
  }
  return results;
}
