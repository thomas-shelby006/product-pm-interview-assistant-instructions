const ROLES = new Set(['sender', 'receiver']);

export function roleLogKey(sessionId, role) {
  const normalizedSession = String(sessionId || '').trim();
  if (!normalizedSession || !ROLES.has(role)) {
    throw new TypeError('Invalid PMIA role log key');
  }
  return `pmia_log_${normalizedSession}_${role}`;
}

export function appendBoundedLog(
  current,
  event,
  maxEvents = 500,
  recordedAt = new Date().toISOString()
) {
  const safeMax = Number.isInteger(maxEvents) && maxEvents >= 2 ? maxEvents : 500;
  const source = Array.isArray(current) ? current : [];
  const priorMarker = source.find(item => item?.type === 'log_truncated');
  const priorDropped = Number.isInteger(priorMarker?.droppedCount)
    ? priorMarker.droppedCount
    : 0;
  const realEvents = source.filter(item => item?.type !== 'log_truncated');
  realEvents.push({ ...event, recordedAt: event?.recordedAt || recordedAt });
  if (!priorDropped && realEvents.length <= safeMax) return realEvents;

  const keepCount = safeMax - 1;
  const newlyDropped = Math.max(0, realEvents.length - keepCount);
  return [
    { type: 'log_truncated', droppedCount: priorDropped + newlyDropped, recordedAt },
    ...realEvents.slice(-keepCount)
  ];
}

export function buildSessionExport({ session, events, exportedAt = new Date().toISOString() }) {
  return {
    schemaVersion: '2.0',
    exportedAt,
    session: { ...session },
    events: Array.isArray(events) ? events : []
  };
}

export function renderSessionMarkdown({ session, events }) {
  const safeEvents = Array.isArray(events) ? events : [];
  const lines = [
    '# PM Interview Dual-Provider Session',
    '',
    `Session: ${session?.sessionId || ''}`,
    `Window: ${session?.role || ''} / ${session?.provider || ''}`,
    '',
    '## Events',
    ''
  ];
  for (const event of safeEvents) {
    lines.push(`### ${event.recordedAt || ''} — ${event.type || 'event'}`, '');
    if (event.text) lines.push(String(event.text), '');
    const metadata = { ...event };
    delete metadata.text;
    lines.push('```json', JSON.stringify(metadata, null, 2), '```', '');
  }
  return lines.join('\n');
}
