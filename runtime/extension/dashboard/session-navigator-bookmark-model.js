const CATEGORIES=new Set(['evidence','follow_up','strong_answer','weak_answer','decision','incident','review']);

function targets(snapshot={}){return{
  question:new Set((snapshot.ledger||[]).map(item=>String(item.id||''))),
  trace:new Set((snapshot.deliveryTraces||snapshot.traces||[]).map(item=>String(item.id||item.traceId||''))),
  marker:new Set((snapshot.operatorMarkers||[]).map(item=>String(item.id||''))),
  incident:new Set((snapshot.incidents?.items||[]).map(item=>String(item.id||''))),
  batch:new Set([snapshot.batchState?.active?.id,snapshot.batchState?.next?.id].map(String).filter(Boolean)),
  session:new Set([String(snapshot.sessionId||'')])
};}

export function validateBookmarkTarget(snapshot = {}, bookmark = {}) {
  const type=String(bookmark.targetType||''),id=String(bookmark.targetId||'');const map=targets(snapshot);
  if(!map[type])return{ok:false,error:'bookmark_target_type_invalid'};if(!id||!map[type].has(id))return{ok:false,error:'bookmark_target_missing'};
  const category=CATEGORIES.has(String(bookmark.category))?String(bookmark.category):'evidence';return{ok:true,bookmark:{id:String(bookmark.id||''),targetType:type,targetId:id,category,label:String(bookmark.label||category).slice(0,160)}};
}

export function deriveBookmarkNavigator(snapshot = {}, options = {}) {
  const category=String(options.category||'all');const query=String(options.query||'').toLowerCase();
  const items=(snapshot.sessionNavigator?.bookmarks||[]).map(item=>({...item,validation:validateBookmarkTarget(snapshot,item)})).filter(item=>(category==='all'||item.category===category)&&(!query||`${item.label} ${item.category} ${item.targetType}`.toLowerCase().includes(query))).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  return{items,count:items.length,invalid:items.filter(item=>!item.validation.ok).length,categories:['all',...CATEGORIES]};
}

export function bookmarkCategories(snapshot = {}) {
  const counts=Object.fromEntries([...CATEGORIES].map(value=>[value,0]));for(const item of snapshot.sessionNavigator?.bookmarks||[])counts[item.category in counts?item.category:'evidence']++;
  return Object.entries(counts).map(([id,count])=>({id,count})).filter(item=>item.count>0);
}

export function bookmarkReviewQueue(snapshot = {}) {
  return(snapshot.sessionNavigator?.bookmarks||[]).filter(item=>!item.reviewedAt).map(item=>({...item,validation:validateBookmarkTarget(snapshot,item)})).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
}
