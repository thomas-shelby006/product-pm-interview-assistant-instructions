import { applySnapshotDeltaChecked } from '../shared/snapshot-delta.js';
export function createDashboardSnapshotSync(){let snapshot=null,generation=0,resyncCount=0,lastResyncReason='';return{
 applyFull(next,{generation:nextGeneration=0}={}){const incoming=Math.max(0,Number(nextGeneration)||0);if(snapshot&&incoming&&incoming<generation)return{ok:false,resyncRequired:true,error:'snapshot_generation_regressed',snapshot,generation};snapshot=next||null;generation=incoming;return{ok:true,snapshot,generation};},
 applyDelta(delta){if(!snapshot)return{ok:false,resyncRequired:true,error:'snapshot_base_missing',snapshot,generation};const result=applySnapshotDeltaChecked(snapshot,delta,{generation});if(result.resyncRequired){resyncCount+=1;lastResyncReason=result.error;return{...result,snapshot,generation};}snapshot=result.snapshot;generation=result.generation;return{...result,snapshot,generation};},
 applyHeartbeat(role,patch={}){if(!snapshot||!['sender','receiver'].includes(role))return{ok:false,snapshot,generation};snapshot={...snapshot,[role]:{...(snapshot[role]||{}),...(patch||{})}};return{ok:true,snapshot,generation};},
 reset(){snapshot=null;generation=0;lastResyncReason='';return{snapshot,generation};},
 snapshot(){return{snapshot,generation,resyncCount,lastResyncReason};}
};}
