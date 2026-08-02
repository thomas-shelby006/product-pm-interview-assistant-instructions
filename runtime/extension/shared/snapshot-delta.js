import { canonicalFingerprint } from './canonical-fingerprint.js';

const VOLATILE_KEYS = new Set(['now','uptimeMs']);
const clone = value => value === undefined ? undefined : structuredClone(value);
function stableSnapshot(value = {}) { return Object.fromEntries(Object.entries(value || {}).filter(([key])=>!VOLATILE_KEYS.has(key))); }
function comparable(value) { return canonicalFingerprint(stableSnapshot(value)); }

export function buildSnapshotDelta(previous, next, { baseGeneration=0, nextGeneration=Number(baseGeneration)+1 }={}) {
  const metadata={
    baseGeneration:Math.max(0,Number(baseGeneration)||0),
    nextGeneration:Math.max(Math.max(0,Number(baseGeneration)||0)+1,Number(nextGeneration)||0),
    baseFingerprint:previous ? comparable(previous) : '',
    nextFingerprint:next ? comparable(next) : ''
  };
  if (!previous || !next) return { ...metadata, full:clone(next), changed:{}, removed:[], keys:[], empty:false };
  const changed={},removed=[],keys=new Set([...Object.keys(previous),...Object.keys(next)]);
  for (const key of keys) {
    if (VOLATILE_KEYS.has(key)) continue;
    if (!(key in next)) { removed.push(key); continue; }
    if (canonicalFingerprint(previous[key])!==canonicalFingerprint(next[key])) changed[key]=clone(next[key]);
  }
  const changedKeys=[...Object.keys(changed),...removed];
  return { ...metadata, changed, removed, keys:changedKeys, empty:changedKeys.length===0 };
}

export function applySnapshotDelta(current, delta) {
  if (delta?.full) return clone(delta.full);
  const next={...(current||{})};
  for (const key of Array.isArray(delta?.removed)?delta.removed:[]) delete next[key];
  for (const [key,value] of Object.entries(delta?.changed||{})) next[key]=clone(value);
  return next;
}

export function applySnapshotDeltaChecked(current, delta, { generation=0 }={}) {
  if (!delta || typeof delta!=='object') return { ok:false,error:'snapshot_delta_missing',resyncRequired:true };
  const currentGeneration=Math.max(0,Number(generation)||0);
  if (Number(delta.baseGeneration||0)!==currentGeneration) return { ok:false,error:'snapshot_generation_mismatch',resyncRequired:true,generation:currentGeneration,expectedGeneration:Number(delta.baseGeneration||0) };
  if (String(delta.baseFingerprint||'') && comparable(current)!==String(delta.baseFingerprint)) return { ok:false,error:'snapshot_base_mismatch',resyncRequired:true,generation:currentGeneration };
  const snapshot=applySnapshotDelta(current,delta);
  if (String(delta.nextFingerprint||'') && comparable(snapshot)!==String(delta.nextFingerprint)) return { ok:false,error:'snapshot_result_mismatch',resyncRequired:true,generation:currentGeneration };
  return { ok:true,snapshot,generation:Math.max(currentGeneration+1,Number(delta.nextGeneration)||0),fingerprint:comparable(snapshot),resyncRequired:false };
}
