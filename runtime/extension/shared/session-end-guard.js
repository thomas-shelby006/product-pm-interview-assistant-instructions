const FINAL_STATES=new Set(['proven','archived']);
const IN_FLIGHT_STATES=new Set(['submitting','submitted','staged']);
function latestOutboxCount(snapshot){if(snapshot?.senderOutboxState&&Number.isFinite(Number(snapshot.senderOutboxState.count)))return Math.max(0,Number(snapshot.senderOutboxState.count||0));const timeline=Array.isArray(snapshot?.timeline)?snapshot.timeline:[];for(let index=timeline.length-1;index>=0;index-=1)if(timeline[index]?.type==='outbox_state')return Math.max(0,Number(timeline[index]?.data?.count||0));return 0;}
function pendingCommandCount(snapshot={}){const direct=Number(snapshot.dashboardOperations?.pending??snapshot.operationActivity?.pending);if(Number.isFinite(direct))return Math.max(0,direct);return(Array.isArray(snapshot.commandJournal)?snapshot.commandJournal:[]).filter(item=>['pending','responding'].includes(String(item?.state||''))).length;}
export function senderOutboxStorageKey(sessionId){return`pmia_sender_outbox_v2:${String(sessionId||'').trim()}`;}

export function sessionEndCounts(snapshot={}){
  const ledger=Array.isArray(snapshot.ledger)?snapshot.ledger:[];
  const ledgerActionable=ledger.filter(item=>!FINAL_STATES.has(String(item?.state||''))).length;
  const summaryActionable=Math.max(0,Number(snapshot.ledgerCounts?.unresolved)||0);
  const ledgerInFlight=ledger.filter(item=>IN_FLIGHT_STATES.has(String(item?.state||''))).length;
  const summaryInFlight=Math.max(0,Number(snapshot.ledgerCounts?.inFlight)||0);
  const activeMembers=Number(snapshot.batchState?.active?.questionCount||snapshot.batchState?.active?.memberIds?.length||0);
  const phase=String(snapshot.liveSession?.phase||'setup'),liveActive=['active','paused'].includes(phase)?1:0,unresolvedChoice=snapshot.operatorChoice?1:0;
  return{actionable:Math.max(ledgerActionable,summaryActionable),inFlight:Math.max(ledgerInFlight,summaryInFlight,activeMembers),unpersisted:latestOutboxCount(snapshot),pendingCommands:pendingCommandCount(snapshot),liveActive,unresolvedChoice,phase};
}

export function prepareSessionEnd(snapshot,{now=Date.now(),token=globalThis.crypto?.randomUUID?.()||`${now}-${Math.random().toString(36).slice(2)}`,ttlMs=30000}={}){
  const counts=sessionEndCounts(snapshot);
  return{token:String(token),preparedAt:Number(now),expiresAt:Number(now)+Math.max(5000,Number(ttlMs)||30000),counts,canEnd:counts.actionable===0&&counts.inFlight===0&&counts.unpersisted===0&&counts.pendingCommands===0&&counts.liveActive===0&&counts.unresolvedChoice===0};
}

export function validateSessionEnd(prepared,{token,mode,now=Date.now(),currentCounts=null}={}){
  if(!prepared?.token||String(token||'')!==String(prepared.token))return{ok:false,error:'confirmation_token_invalid'};
  if(Number(now)>Number(prepared.expiresAt||0))return{ok:false,error:'confirmation_token_expired'};
  const normalizedMode=String(mode||'clean');if(!['clean','archive_and_end'].includes(normalizedMode))return{ok:false,error:'invalid_end_mode'};
  const counts=currentCounts||prepared.counts||{};
  const changed=currentCounts&&['actionable','inFlight','unpersisted','pendingCommands','liveActive','unresolvedChoice'].some(key=>Number(currentCounts[key]||0)!==Number(prepared.counts?.[key]||0));
  if(changed)return{ok:false,error:'session_end_state_changed',counts};
  if(Number(counts.unpersisted||0)>0)return{ok:false,error:'unpersisted_outbox_present',counts};
  if(Number(counts.pendingCommands||0)>0)return{ok:false,error:'pending_commands_active',counts};
  if(Number(counts.liveActive||0)>0)return{ok:false,error:'live_session_active',counts};
  if(!prepared.canEnd&&normalizedMode!=='archive_and_end')return{ok:false,error:'actionable_finals_present',counts};
  return{ok:true,mode:normalizedMode,counts};
}
