const SEVERITY = Object.freeze({ critical:4, error:3, warn:2, info:1, none:0 });
const WARNING_ACTIONS = Object.freeze({
  runtime_blocked:['repair_runtime','overview','readinessGate'], runtime_degraded:['check_live','overview','readinessGate'],
  session_storage_critical:['compact_proven','review','memoryGuard'], receiver_draft_conflict:['','queue','draftConflictState'],
  inbox_oldest_stale:['resume_catch_up','queue','queueBody'], sender_source_silent:['check_live','overview','hiddenRuntimeState']
});
function stableId(source,code,target='') { return `${source}:${code}:${target}`.replace(/[^a-z0-9:_-]+/gi,'_').slice(0,180); }
function add(list,value) {
  if (!value?.code) return;
  const actionMode = ['execute','choose','inspect'].includes(value.actionMode) ? value.actionMode : value.command ? 'execute' : 'inspect';
  list.push({
    id:stableId(value.source || 'runtime',value.code,value.target || ''), source:String(value.source || 'runtime'), code:String(value.code),
    severity:SEVERITY[value.severity] == null ? 'info' : value.severity, title:String(value.title || value.code).slice(0,120),
    detail:String(value.detail || '').slice(0,280), command:actionMode === 'execute' ? String(value.command || '') : '',
    payload:actionMode === 'execute' && value.payload && typeof value.payload === 'object' ? {...value.payload} : {},
    actionMode, choices:Array.isArray(value.choices) ? value.choices.map(String).slice(0,8) : [],
    view:String(value.view || 'overview'), anchor:String(value.anchor || ''), target:String(value.target || ''),
    createdAt:Math.max(0,Number(value.createdAt || 0))
  });
}
export function deriveOperatorDecisionCenter(snapshot = {}, now = Date.now()) {
  const list=[]; const batch=snapshot.batchState || {};
  if (batch.pendingNoResponse) add(list,{ source:'answer', code:'answer_no_response', severity:'critical', title:'Choose what happens after no response', detail:'Window 2 did not produce an answer. Select Wait, Retry, or Continue explicitly.', actionMode:'choose', choices:['wait','retry','continue'], view:'queue', anchor:'receiverPolicyState', createdAt:batch.pendingNoResponse.createdAt || now });
  if (['unresolved','keep_manual'].includes(batch.draftConflict?.state)) add(list,{ source:'composer', code:'receiver_draft_conflict', severity:'error', title:'Choose the Window 2 draft owner', detail:'Manual text and the protected PMIA batch both exist. Select Keep manual, Restore PMIA, or Merge explicitly.', actionMode:'choose', choices:['keep_manual','restore_pmia','merge'], view:'queue', anchor:'draftConflictState' });
  if (snapshot.deliveryPolicy?.active) add(list,{ source:'delivery', code:'queue_only_active', severity:'error', title:'Provider writes are contained', detail:`Finals remain durable while ${snapshot.deliveryPolicy.reason || 'runtime safety'} blocks provider writes.`, command:'check_live', view:'overview', anchor:'deliveryPolicyBanner' });
  for (const warning of snapshot.warnings || []) { const [command,view,anchor]=WARNING_ACTIONS[warning.code] || ['','overview','diagnosticGroups']; add(list,{ source:'warning', code:warning.code, severity:warning.severity === 'error' ? 'error' : 'warn', title:String(warning.code || '').replaceAll('_',' '), detail:warning.count ? `${warning.count} affected item(s).` : warning.ageMs ? `${Math.round(warning.ageMs/1000)} seconds old.` : '', command, actionMode:warning.code === 'receiver_draft_conflict' ? 'choose' : command ? 'execute' : 'inspect', view, anchor }); }
  for (const incident of snapshot.incidents?.items || []) add(list,{ source:'incident', code:incident.code || incident.id || 'incident', severity:incident.severity === 'critical' ? 'critical' : incident.severity === 'error' ? 'error' : 'warn', title:incident.title || incident.code || 'Runtime incident', detail:incident.summary || incident.detail || '', command:incident.command || '', view:'overview', anchor:'incidentCenterTitle', target:incident.id || '', createdAt:incident.createdAt || 0 });
  if (snapshot.endGuard && snapshot.endGuard.canEnd === false) add(list,{ source:'session', code:'end_guard_blocked', severity:'warn', title:'Session end is guarded', detail:`${Number(snapshot.endGuard.counts?.actionable || 0)} actionable, ${Number(snapshot.endGuard.counts?.inFlight || 0)} in flight, ${Number(snapshot.endGuard.counts?.unpersisted || 0)} unpersisted.`, actionMode:'choose', choices:['return_live','export','archive_and_end'], view:'review', anchor:'endSessionAction' });
  const items=[...new Map(list.map(item=>[item.id,item])).values()].sort((a,b)=>(SEVERITY[b.severity]-SEVERITY[a.severity]) || (b.createdAt-a.createdAt) || a.id.localeCompare(b.id)).slice(0,20);
  return { state:items.length ? items[0].severity : 'clear', count:items.length, primary:items[0] || null, items, evaluatedAt:now };
}