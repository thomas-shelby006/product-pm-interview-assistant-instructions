const PRIORITY = Object.freeze({ error: 3, warn: 2, info: 1 });

function issue(code, owner, severity = 'warn', detail = {}) {
  return { code, owner, severity, ...detail };
}

export function auditLiveCommandIntegrity(snapshot = {}, now = Date.now()) {
  const issues = [];
  const ledgerIds = new Set((snapshot.ledger || []).map(item => String(item.id || '')).filter(Boolean));
  const metadata = snapshot.questionOperations?.metadata || {};
  for (const [id, value] of Object.entries(metadata)) {
    if (!ledgerIds.has(id)) issues.push(issue('question_metadata_orphan', 'triage', 'warn', { itemId: id }));
    if (value?.parentId && !ledgerIds.has(String(value.parentId))) issues.push(issue('question_parent_orphan', 'triage', 'error', { itemId: id, parentId: String(value.parentId) }));
    if (String(value?.parentId || '') === id) issues.push(issue('question_parent_self', 'triage', 'error', { itemId: id }));
  }
  for (const marker of snapshot.operatorMarkers || []) if (marker.itemId && !ledgerIds.has(String(marker.itemId))) issues.push(issue('marker_target_orphan', 'marker', 'warn', { markerId: String(marker.id || '') }));
  const activeIncidentIds = new Set((snapshot.incidentCenter?.incidents || []).map(item => String(item.id || '')));
  for (const id of Object.keys(snapshot.incidentControls?.controls || {})) if (!activeIncidentIds.has(id)) issues.push(issue('incident_control_orphan', 'incident', 'info', { incidentId: id }));
  const undo = snapshot.questionOperations?.undoJournal || [];
  for (const entry of undo) {
    if (!entry.id || !entry.itemId || !entry.action) issues.push(issue('undo_entry_invalid', 'triage', 'warn'));
    else if (Number(entry.expiresAt || 0) < now && !entry.usedAt) issues.push(issue('undo_entry_expired', 'triage', 'info', { undoId: entry.id }));
  }
  const focused = snapshot.layout?.focusedRole;
  if (focused && !['sender','receiver','pilot'].includes(String(focused))) issues.push(issue('layout_focus_invalid', 'focus', 'error', { focusedRole: String(focused) }));
  const ordered = issues.sort((a, b) => (PRIORITY[b.severity] || 0) - (PRIORITY[a.severity] || 0) || a.code.localeCompare(b.code));
  return { ok: !ordered.some(item => item.severity === 'error'), state: ordered.some(item => item.severity === 'error') ? 'blocked' : ordered.length ? 'repairable' : 'healthy', issues: ordered, repairable: ordered.every(item => item.code !== 'question_parent_self') };
}

export function repairLiveCommandMetadata(snapshot = {}, now = Date.now()) {
  const ledgerIds = new Set((snapshot.ledger || []).map(item => String(item.id || '')).filter(Boolean));
  const metadata = Object.fromEntries(Object.entries(snapshot.questionOperations?.metadata || {}).filter(([id]) => ledgerIds.has(id)).map(([id, value]) => [id, value?.parentId && (!ledgerIds.has(String(value.parentId)) || String(value.parentId) === id) ? { ...value, parentId: '' } : { ...value }]));
  const markers = (snapshot.operatorMarkers || []).filter(marker => !marker.itemId || ledgerIds.has(String(marker.itemId)));
  const incidentIds = new Set((snapshot.incidentCenter?.incidents || []).map(item => String(item.id || '')));
  const controls = Object.fromEntries(Object.entries(snapshot.incidentControls?.controls || {}).filter(([id]) => incidentIds.has(id)));
  const undoJournal = (snapshot.questionOperations?.undoJournal || []).filter(entry => entry?.id && entry?.itemId && entry?.action && (entry.usedAt || Number(entry.expiresAt || 0) >= now));
  return { metadata, markers, controls, undoJournal, repairedAt: now };
}
