const SEVERITY = Object.freeze({ critical: 4, error: 3, warn: 2, info: 1, none: 0 });
const WARNING_ACTIONS = Object.freeze({
  runtime_blocked: ['repair_runtime', 'overview', 'readinessGate'],
  runtime_degraded: ['check_live', 'overview', 'readinessGate'],
  session_storage_critical: ['compact_proven', 'review', 'memoryGuard'],
  receiver_draft_conflict: ['resolve_draft_restore_pmia', 'queue', 'questionInspector'],
  inbox_oldest_stale: ['resume_catch_up', 'queue', 'queueBody'],
  sender_source_silent: ['check_live', 'overview', 'hiddenRuntimeState']
});
function stableId(source, code, target = '') { return `${source}:${code}:${target}`.replace(/[^a-z0-9:_-]+/gi, '_').slice(0, 180); }
function add(list, value) {
  if (!value?.code) return;
  list.push({
    id: stableId(value.source || 'runtime', value.code, value.target || ''),
    source: String(value.source || 'runtime'), code: String(value.code),
    severity: SEVERITY[value.severity] == null ? 'info' : value.severity,
    title: String(value.title || value.code).slice(0, 120),
    detail: String(value.detail || '').slice(0, 280),
    command: String(value.command || ''), payload: value.payload && typeof value.payload === 'object' ? { ...value.payload } : {},
    view: String(value.view || 'overview'), anchor: String(value.anchor || ''),
    target: String(value.target || ''), createdAt: Math.max(0, Number(value.createdAt || 0))
  });
}
export function deriveOperatorDecisionCenter(snapshot = {}, now = Date.now()) {
  const list = [];
  const batch = snapshot.batchState || {};
  if (batch.pendingNoResponse) add(list, { source: 'answer', code: 'answer_no_response', severity: 'critical', title: 'Choose what happens after no response', detail: 'Window 2 did not produce an answer. Continue releases the protected next batch; Retry resubmits the completed batch.', command: 'resolve_no_response', payload: { action: 'continue' }, view: 'queue', anchor: 'receiverPolicyState', createdAt: batch.pendingNoResponse.createdAt || now });
  if (['unresolved','keep_manual'].includes(batch.draftConflict?.state)) add(list, { source: 'composer', code: 'receiver_draft_conflict', severity: 'error', title: 'Resolve the Window 2 draft conflict', detail: 'Manual text and the protected PMIA batch both exist. Choose the intended composer owner.', command: 'resolve_draft_restore_pmia', view: 'queue', anchor: 'draftConflictState' });
  if (snapshot.deliveryPolicy?.active) add(list, { source: 'delivery', code: 'queue_only_active', severity: 'error', title: 'Provider writes are contained', detail: `Finals remain durable while ${snapshot.deliveryPolicy.reason || 'runtime safety'} blocks provider writes.`, command: 'check_live', view: 'overview', anchor: 'deliveryPolicyBanner' });
  for (const warning of Array.isArray(snapshot.warnings) ? snapshot.warnings : []) {
    const [command, view, anchor] = WARNING_ACTIONS[warning.code] || ['', 'overview', 'diagnosticGroups'];
    add(list, { source: 'warning', code: warning.code, severity: warning.severity === 'error' ? 'error' : 'warn', title: String(warning.code || '').replaceAll('_',' '), detail: warning.count ? `${warning.count} affected item(s).` : warning.ageMs ? `${Math.round(warning.ageMs / 1000)} seconds old.` : '', command, view, anchor });
  }
  for (const incident of snapshot.incidents?.items || []) add(list, { source: 'incident', code: incident.code || incident.id || 'incident', severity: incident.severity === 'critical' ? 'critical' : incident.severity === 'error' ? 'error' : 'warn', title: incident.title || incident.code || 'Runtime incident', detail: incident.summary || incident.detail || '', command: incident.command || '', view: 'overview', anchor: 'incidentCenterTitle', target: incident.id || '', createdAt: incident.createdAt || 0 });
  if (snapshot.endGuard && snapshot.endGuard.canEnd === false) add(list, { source: 'session', code: 'end_guard_blocked', severity: 'warn', title: 'Session end is guarded', detail: `${Number(snapshot.endGuard.counts?.actionable || 0)} actionable, ${Number(snapshot.endGuard.counts?.inFlight || 0)} in flight, ${Number(snapshot.endGuard.counts?.unpersisted || 0)} unpersisted.`, command: 'prepare_end_session', view: 'review', anchor: 'endSessionAction' });
  const deduped = [...new Map(list.map(item => [item.id, item])).values()];
  deduped.sort((a,b) => (SEVERITY[b.severity]-SEVERITY[a.severity]) || (b.createdAt-a.createdAt) || a.id.localeCompare(b.id));
  const items = deduped.slice(0, 20);
  return { state: items.length ? items[0].severity : 'clear', count: items.length, primary: items[0] || null, items, evaluatedAt: now };
}
