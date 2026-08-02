function text(value, max = 240) { return String(value || '').trim().slice(0, max); }
function tokens(value) { return text(value, 400).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }

function entity(id, type, label, detail, view, anchor, at = 0, extra = {}) {
  return { id:text(id,180), type, label:text(label,200), detail:text(detail,300), view, anchor:text(anchor,160), at:Math.max(0,Number(at||0)), ...extra };
}

export function buildSessionSearchIndex(snapshot = {}) {
  const output = [];
  for (const item of Array.isArray(snapshot.ledger) ? snapshot.ledger : []) {
    output.push(entity(item.id,'question',item.text || item.id,`${item.state || 'unknown'} · sequence ${item.seq || item.providerSeq || 0}`,'queue','queueList',item.persistedAt,{state:item.state || '',priority:snapshot.questionOperations?.metadata?.[item.id]?.priority || 'normal'}));
  }
  for (const marker of Array.isArray(snapshot.operatorMarkers) ? snapshot.operatorMarkers : []) {
    output.push(entity(marker.id,'marker',marker.category || 'Marker',`${marker.targetType || 'session'} · ${marker.targetId || ''}`,'review','markerList',marker.createdAt,{category:marker.category || ''}));
  }
  for (const event of Array.isArray(snapshot.timeline) ? snapshot.timeline.slice(-200) : []) {
    output.push(entity(event.id,'event',event.type || 'Event',Object.values(event.data || {}).filter(value=>['string','number'].includes(typeof value)).join(' '),'timeline','timelineViewport',event.at));
  }
  for (const item of Array.isArray(snapshot.incidents?.items) ? snapshot.incidents.items : []) {
    output.push(entity(item.id,'incident',item.title || item.code || 'Incident',item.detail || item.reason || '','overview','incidentCenter',item.at,{severity:item.severity || ''}));
  }
  for (const bookmark of snapshot.sessionNavigator?.bookmarks || []) {
    output.push(entity(bookmark.id,'bookmark',bookmark.label || bookmark.category,`${bookmark.targetType} · ${bookmark.targetId}`,'navigator','navigatorBookmarks',bookmark.createdAt,{targetType:bookmark.targetType,targetId:bookmark.targetId}));
  }
  return output.filter(item=>item.id && item.label);
}

function score(item, queryTokens = []) {
  const haystack = tokens(`${item.type} ${item.label} ${item.detail} ${item.state || ''} ${item.category || ''} ${item.severity || ''}`);
  let value = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) value += 8;
    else if (haystack.some(word=>word.startsWith(token))) value += 4;
    else if (haystack.some(word=>word.includes(token))) value += 2;
  }
  if (item.type === 'question') value += 3;
  if (item.severity === 'error') value += 3;
  if (item.priority === 'critical') value += 4;
  return value + Math.min(2, item.at / 1e13);
}

export function searchSessionEntities(index = [], query = '', limit = 40) {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return [...index].sort((a,b)=>b.at-a.at).slice(0,limit).map(item=>({...item,score:0}));
  return index.map(item=>({...item,score:score(item,queryTokens)})).filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score || b.at-a.at || a.label.localeCompare(b.label)).slice(0,Math.max(1,limit));
}

export function buildSearchPreview(item = null) {
  if (!item) return { available:false, title:'No result selected', detail:'Search questions, incidents, markers and events.', jump:null };
  return { available:true, title:item.label, detail:item.detail, type:item.type, state:item.state || '', jump:{ view:item.view, anchor:item.anchor, entityType:item.type, entityId:item.id } };
}

export function validateNavigatorJumpIntent(intent = {}, snapshot = {}) {
  const view = ['overview','navigator','queue','timeline','review','assist','production'].includes(String(intent.view)) ? String(intent.view) : '';
  const entityId = text(intent.entityId,180);
  if (!view) return { ok:false,error:'navigator_view_invalid' };
  if (intent.entityType === 'question' && !(snapshot.ledger || []).some(item=>item.id===entityId)) return { ok:false,error:'navigator_target_stale' };
  return { ok:true, route:{view,anchor:text(intent.anchor,160),entityType:text(intent.entityType,40),entityId,reason:'session_navigator_jump'} };
}

export function recentNavigatorHistory(persisted = [], local = [], limit = 12) {
  const all = [...persisted,...local].filter(item=>item?.id).sort((a,b)=>Number(b.at||0)-Number(a.at||0));
  const seen=new Set();
  return all.filter(item=>{const key=`${item.tab}:${item.entityType}:${item.entityId}`;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit);
}
