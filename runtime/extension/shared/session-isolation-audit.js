export function auditSessionIsolation(sessions = []) {
  const issues = [];
  const tabs = new Map();
  const runtimeInstances = new Map();
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const sessionId = String(session.sessionId || '');
    for (const role of ['sender','receiver','comparison']) {
      const value = session[role] || {};
      if (value.tabId) {
        const key = String(value.tabId);
        if (tabs.has(key) && tabs.get(key).sessionId !== sessionId) issues.push({ code: 'tab_shared_across_sessions', tabId: value.tabId, sessions: [tabs.get(key).sessionId, sessionId], roles: [tabs.get(key).role, role] });
        else tabs.set(key, { sessionId, role });
      }
      if (value.instanceId) {
        const key = String(value.instanceId);
        if (runtimeInstances.has(key) && runtimeInstances.get(key).sessionId !== sessionId) issues.push({ code: 'runtime_instance_shared', instanceId: key, sessions: [runtimeInstances.get(key).sessionId, sessionId] });
        else runtimeInstances.set(key, { sessionId, role });
      }
    }
  }
  return { ok: issues.length === 0, issues, tabCount: tabs.size, runtimeCount: runtimeInstances.size, sessionCount: (sessions || []).length };
}
