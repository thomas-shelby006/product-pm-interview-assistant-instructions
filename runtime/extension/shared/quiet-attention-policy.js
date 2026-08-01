const LEVEL = Object.freeze({ info: 1, warn: 2, error: 3, critical: 4 });

export function deriveQuietAttention({ incidents = [], attention = null } = {}, enabled = false, now = Date.now()) {
  const visible = (Array.isArray(incidents) ? incidents : []).filter(item => item.visible !== false && Number(item.snoozedUntil || 0) <= now);
  const surfaced = enabled
    ? visible.filter(item => LEVEL[item.severity] >= LEVEL.error || !item.acknowledgedAt)
    : visible;
  const primary = surfaced[0] || null;
  const fallback = attention || { target: 'none', severity: 'none', title: 'Caught up', detail: 'No operator action is required.', command: '' };
  return {
    enabled: Boolean(enabled),
    visibleIncidents: surfaced,
    hiddenCount: Math.max(0, visible.length - surfaced.length),
    attention: primary ? {
      target: primary.owner || 'runtime',
      severity: primary.severity,
      title: String(primary.code || 'Runtime incident').replaceAll('_', ' '),
      detail: primary.acknowledgedAt ? 'Acknowledged incident remains active.' : 'This is the highest-priority active incident.',
      command: primary.action || 'check_live',
      incidentId: primary.id
    } : fallback
  };
}
