const SEVERITY = Object.freeze({ info: 1, warn: 2, error: 3, critical: 4 });
const MAX_INCIDENTS = 80;

function keyOf(value = {}) {
  return [String(value.owner || 'runtime'), String(value.code || 'unknown'), String(value.role || '')].join(':');
}

function safeIncident(value = {}, now = Date.now()) {
  return {
    id: keyOf(value), owner: String(value.owner || 'runtime'), code: String(value.code || 'unknown'),
    role: String(value.role || ''), severity: SEVERITY[value.severity] ? value.severity : 'warn',
    action: String(value.action || value.nextAction || 'check_live'),
    firstSeenAt: Math.max(0, Number(value.firstSeenAt || now)),
    lastSeenAt: Math.max(0, Number(now)), occurrences: Math.max(1, Number(value.occurrences || 1)),
    acknowledgedAt: Math.max(0, Number(value.acknowledgedAt || 0)),
    snoozedUntil: Math.max(0, Number(value.snoozedUntil || 0)), resolvedAt: 0
  };
}

export function deriveIncidents(snapshot = {}, now = Date.now()) {
  const values = [];
  for (const warning of snapshot.warnings || []) values.push({
    owner: warning.role ? 'provider' : 'runtime', code: warning.code, role: warning.role,
    severity: warning.severity === 'error' ? 'error' : 'warn', action: warning.action || 'check_live'
  });
  if (snapshot.rootCause?.code && snapshot.rootCause.code !== 'healthy') values.push({
    owner: snapshot.rootCause.owner, code: snapshot.rootCause.code, severity: snapshot.rootCause.severity,
    action: snapshot.rootCause.nextAction
  });
  if (snapshot.consistencyAudit?.ok === false) values.push({
    owner: 'state', code: snapshot.consistencyAudit.reason || 'consistency_failed', severity: 'error', action: 'check_live'
  });
  const map = new Map();
  for (const item of values) {
    const safe = safeIncident(item, now);
    const prior = map.get(safe.id);
    map.set(safe.id, prior ? { ...prior, lastSeenAt: now, occurrences: prior.occurrences + 1,
      severity: SEVERITY[safe.severity] > SEVERITY[prior.severity] ? safe.severity : prior.severity } : safe);
  }
  return [...map.values()].sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity] || b.lastSeenAt - a.lastSeenAt);
}

export function mergeIncidentState(derived = [], controls = {}, prior = [], now = Date.now()) {
  const previous = new Map((prior || []).map(item => [item.id, item]));
  const output = [];
  for (const value of derived) {
    const control = controls[value.id] || {};
    const old = previous.get(value.id);
    const escalated = old && SEVERITY[value.severity] > SEVERITY[old.severity];
    output.push({
      ...value,
      firstSeenAt: old?.firstSeenAt || value.firstSeenAt,
      occurrences: Math.max(value.occurrences, Number(old?.occurrences || 0) + 1),
      acknowledgedAt: escalated ? 0 : Math.max(0, Number(control.acknowledgedAt || old?.acknowledgedAt || 0)),
      snoozedUntil: escalated ? 0 : Math.max(0, Number(control.snoozedUntil || old?.snoozedUntil || 0)),
      visible: escalated || Number(control.snoozedUntil || 0) <= now
    });
  }
  return output.slice(0, MAX_INCIDENTS);
}

export function updateIncidentControl(controls = {}, id, action, now = Date.now(), durationMs = 0) {
  const key = String(id || '');
  if (!key) return { ...controls };
  const next = { ...controls, [key]: { ...(controls[key] || {}) } };
  if (action === 'acknowledge') next[key].acknowledgedAt = now;
  else if (action === 'snooze') next[key].snoozedUntil = now + Math.max(60_000, Number(durationMs) || 300_000);
  else if (action === 'clear') delete next[key];
  return next;
}

export function incidentDigest(values = []) {
  return values.map(item => `${item.id}:${item.severity}:${item.acknowledgedAt || 0}:${item.snoozedUntil || 0}`).sort().join('|');
}
