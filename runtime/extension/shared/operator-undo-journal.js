import { canonicalFingerprint } from './canonical-fingerprint.js';

const MAX_ENTRIES=32,DEFAULT_TTL_MS=5*60_000;
const clone=value=>value&&typeof value==='object'?JSON.parse(JSON.stringify(value)):null;

export function normalizeUndoJournal(value=[]){
  return(Array.isArray(value)?value:[]).slice(-MAX_ENTRIES).map(item=>{const after=clone(item.after);return{id:String(item.id||''),action:String(item.action||''),itemId:String(item.itemId||''),before:clone(item.before),after,afterFingerprint:String(item.afterFingerprint|| (after?canonicalFingerprint(after):'')),createdAt:Math.max(0,Number(item.createdAt||0)),expiresAt:Math.max(0,Number(item.expiresAt||0)),usedAt:Math.max(0,Number(item.usedAt||0))};}).filter(item=>item.id&&item.action&&item.itemId);
}

export function recordUndo(journal=[],change={},now=Date.now(),ttlMs=DEFAULT_TTL_MS){
  const itemId=String(change.itemId||''),action=String(change.action||'metadata_change');if(!itemId||!change.before||!change.after)return normalizeUndoJournal(journal);
  const after=clone(change.after),entry={id:String(change.id||`${action}:${itemId}:${now}`),action,itemId,before:clone(change.before),after,afterFingerprint:canonicalFingerprint(after),createdAt:Number(now),expiresAt:Number(now)+Math.max(1,Number(ttlMs)||DEFAULT_TTL_MS),usedAt:0};
  return[...normalizeUndoJournal(journal),entry].slice(-MAX_ENTRIES);
}

export function latestUndo(journal=[],now=Date.now()){return[...normalizeUndoJournal(journal)].reverse().find(item=>!item.usedAt&&item.expiresAt>=now)||null;}

export function consumeUndo(journal=[],undoId,now=Date.now(),{current=null,currentFingerprint=''}={}){
  const values=normalizeUndoJournal(journal),index=values.findIndex(item=>item.id===String(undoId||'')&&!item.usedAt&&item.expiresAt>=Number(now));
  if(index<0)return{ok:false,error:'undo_unavailable',journal:values};
  const entry=values[index],fingerprint=String(currentFingerprint|| (current?canonicalFingerprint(current):''));
  if(fingerprint&&fingerprint!==entry.afterFingerprint)return{ok:false,error:'undo_state_changed',expectedFingerprint:entry.afterFingerprint,currentFingerprint:fingerprint,journal:values};
  values[index]={...entry,usedAt:Number(now)};return{ok:true,entry,journal:values};
}
