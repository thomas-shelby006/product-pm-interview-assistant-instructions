export function buildSessionMeta(options = {}) {
  const roles = Object.fromEntries((options.roles || []).map(value => [value.role, value.provider]));
  const windows = {};
  (options.roles || []).forEach((value, index) => {
    const id = options.launch?.providerWindows?.[index]?.id;
    if (Number.isFinite(id)) windows[value.role] = id;
  });
  const cockpitId = options.launch?.cockpitWindow?.id;
  if (Number.isFinite(cockpitId)) windows.cockpit = cockpitId;
  return {
    sessionId:String(options.sessionId || ''),
    startedAt:Number(options.startedAt) || Date.now(),
    roles,
    windows,
    layout:options.launch?.layout || null
  };
}

export function deriveReadiness({ meta = {}, snapshot = {} } = {}) {
  const configured = Object.keys(meta.roles || {});
  const missing = configured.filter(role => snapshot.roles?.[role] !== true);
  if (!configured.length || missing.length === configured.length) return { state:'waiting', label:'Waiting', detail:'Connecting windows' };
  if (!missing.length) return { state:'ready', label:'Ready', detail:'All configured windows connected' };
  const names = { sender:'Window 1', receiver:'Window 2', comparison:'Window 3' };
  return { state:'degraded', label:'Delivery issue', detail:`${missing.map(role => names[role] || role).join(', ')} disconnected` };
}

export function windowIdForRole(meta = {}, role = '') {
  if (!['sender','receiver','comparison','cockpit'].includes(role)) return null;
  const value = meta.windows?.[role];
  return Number.isFinite(value) ? value : null;
}

export const roleWindowId = windowIdForRole;

export function unresolvedLabel(count) {
  const value = Math.max(0, Number(count) || 0);
  if (!value) return 'Ready';
  return `${value} delivery issue${value === 1 ? '' : 's'}`;
}

export function deriveEndState(unresolvedCount) {
  const count = Math.max(0, Number(unresolvedCount) || 0);
  return { canEnd:count === 0, unresolvedCount:count };
}

export function managedWindowIds(meta = {}) {
  const ids = ['sender','receiver','comparison','cockpit']
    .map(role => windowIdForRole(meta, role))
    .filter(Number.isFinite);
  return [...new Set(ids)];
}