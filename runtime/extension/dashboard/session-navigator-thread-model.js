function metadata(snapshot,id){return snapshot.questionOperations?.metadata?.[id] || {};}
function nodes(snapshot={}){return (snapshot.ledger||[]).map(item=>({id:String(item.id||''),seq:Number(item.seq||item.providerSeq||0),state:String(item.state||''),text:String(item.text||''),meta:metadata(snapshot,item.id)})).filter(item=>item.id);}

export function buildQuestionThreadGraph(snapshot = {}) {
  const list=nodes(snapshot); const byId=new Map(list.map(item=>[item.id,item])); const children=new Map(); const roots=[]; const invalid=[];
  for(const item of list){const parentId=String(item.meta.parentId||'');if(parentId && parentId!==item.id && byId.has(parentId)){if(!children.has(parentId))children.set(parentId,[]);children.get(parentId).push(item.id);}else{roots.push(item.id);if(parentId)invalid.push({itemId:item.id,parentId,reason:parentId===item.id?'self_link':'missing_parent'});}}
  for(const values of children.values())values.sort((a,b)=>byId.get(a).seq-byId.get(b).seq);
  roots.sort((a,b)=>byId.get(a).seq-byId.get(b).seq);
  return {nodes:Object.fromEntries(list.map(item=>[item.id,{...item,children:children.get(item.id)||[]}])) ,roots,invalid};
}

export function questionFollowUpChain(graph = {}, itemId) {
  const output=[]; const seen=new Set(); let current=String(itemId||'');
  while(current && graph.nodes?.[current] && !seen.has(current)){seen.add(current);const node=graph.nodes[current];output.unshift(node);current=String(node.meta?.parentId||'');}
  return output;
}

export function deriveThreadCompletion(graph = {}, rootId) {
  const queue=[String(rootId||'')],items=[];while(queue.length){const id=queue.shift();const node=graph.nodes?.[id];if(!node)continue;items.push(node);queue.push(...(node.children||[]));}
  const unresolved=items.filter(item=>!['proven','archived'].includes(item.state));
  return {rootId:String(rootId||''),count:items.length,unresolved:unresolved.length,complete:items.length>0&&unresolved.length===0,items};
}

export function dependencyMarkers(graph = {}) {
  return Object.values(graph.nodes||{}).filter(node=>(node.children||[]).length || node.meta?.parentId).map(node=>({id:node.id,parentId:String(node.meta?.parentId||''),children:[...(node.children||[])],hasMissingParent:Boolean(node.meta?.parentId&&!graph.nodes[node.meta.parentId])}));
}

export function validateQuestionRelationship(snapshot = {}, itemId, parentId) {
  const item=String(itemId||''),parent=String(parentId||''); const ids=new Set((snapshot.ledger||[]).map(value=>String(value.id||'')));
  if(!item||!parent)return{ok:false,error:'relationship_ids_required'};if(item===parent)return{ok:false,error:'relationship_self_link'};if(!ids.has(item)||!ids.has(parent))return{ok:false,error:'relationship_target_missing'};
  let cursor=parent;const meta=snapshot.questionOperations?.metadata||{};const seen=new Set([item]);while(cursor){if(seen.has(cursor))return{ok:false,error:'relationship_cycle'};seen.add(cursor);cursor=String(meta[cursor]?.parentId||'');}
  return{ok:true,itemId:item,parentId:parent};
}
