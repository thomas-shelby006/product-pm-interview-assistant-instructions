function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function fingerprint(report = {}) {
  const safe = {
    phase: String(report.phase || ''),
    ok: report.ok !== false,
    verified: Boolean(report.verified),
    pendingVerification: Boolean(report.pendingVerification),
    error: String(report.error || ''),
    checks: stable(report.checks || {}),
    actions: (Array.isArray(report.actions) ? report.actions : []).map(item => ({ role: String(item?.role || ''), action: String(item?.action || '') })),
    unresolved: (Array.isArray(report.unresolved) ? report.unresolved : []).map(item => ({ role: String(item?.role || ''), reason: String(item?.reason || '') }))
  };
  return JSON.stringify(safe);
}

export function createRepairEventCoalescer({ cooldownMs = 1000 } = {}) {
  const sessions = new Map();
  return {
    accept(sessionId, report = {}, now = Date.now()) {
      const id = String(sessionId || '');
      const nextFingerprint = fingerprint(report);
      const previous = sessions.get(id) || { fingerprint: '', lastPersistAt: 0, suppressed: 0 };
      const changed = previous.fingerprint !== nextFingerprint;
      const cooldownElapsed = Number(now) - Number(previous.lastPersistAt || 0) >= Math.max(0, Number(cooldownMs) || 0);
      if (changed || !previous.lastPersistAt || cooldownElapsed) {
        const result = { persist: true, report: { ...report, suppressedTransitions: previous.suppressed }, suppressed: previous.suppressed };
        sessions.set(id, { fingerprint: nextFingerprint, lastPersistAt: Number(now), suppressed: 0 });
        return result;
      }
      const suppressed = previous.suppressed + 1;
      sessions.set(id, { ...previous, suppressed });
      return { persist: false, report: { ...report, suppressedTransitions: suppressed }, suppressed };
    },
    clear(sessionId) { sessions.delete(String(sessionId || '')); }
  };
}