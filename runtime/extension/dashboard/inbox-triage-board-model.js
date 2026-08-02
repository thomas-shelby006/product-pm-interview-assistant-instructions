function metadata(snapshot,id){ return snapshot.questionOperations?.metadata?.[id] || {}; }
function status(item){ return String(item?.state || 'persisted'); }
export function deriveInboxTriageBoard(snapshot = {}, now = Date.now(), selectedView = 'urgent') {
  const ledger=[...(snapshot.ledger || [])].sort((a,b)=>Number(a.envelope?.seq || 0)-Number(b.envelope?.seq || 0));
  const views={ urgent:[], stale:[], deferred:[], pinned:[], follow_up:[], proof_pending:[] };
  for(const item of ledger){ const id=String(item.id || ''); const meta=metadata(snapshot,id); const age=Math.max(0,now-Number(item.persistedAt || item.updatedAt || now)); const row={ id, seq:Number(item.envelope?.seq || 0), state:status(item), priority:String(meta.priority || 'normal'), pinned:Boolean(meta.pinned), deferred:Boolean(meta.deferCondition && meta.deferCondition!=='none'), parentId:String(meta.parentId || ''), ageMs:age };
    if(['critical','high'].includes(row.priority) && !['proven','archived'].includes(row.state)) views.urgent.push(row);
    if(age>=120000 && !['proven','archived'].includes(row.state)) views.stale.push(row);
    if(row.deferred) views.deferred.push(row); if(row.pinned) views.pinned.push(row); if(row.parentId) views.follow_up.push(row);
    if(['staged','submitting','failed'].includes(row.state)) views.proof_pending.push(row);
  }
  return { selectedView:views[selectedView] ? selectedView : 'urgent', counts:Object.fromEntries(Object.entries(views).map(([key,value])=>[key,value.length])), items:views[views[selectedView] ? selectedView : 'urgent'], views:Object.keys(views), evaluatedAt:now };
}