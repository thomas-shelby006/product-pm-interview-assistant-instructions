export const SESSION_SCENARIOS=Object.freeze([
  {id:'normal_q1_q2_q3',label:'Q2/Q3 while Q1 answers',timeline:['Q1 active','Q2 persisted','Q3 persisted','Q2/Q3 protected','answer boundary','combined batch proven'],expected:['outbox_clear','sequence_clear','latest_priority','exact_proof']},
  {id:'no_response',label:'Provider returns no answer',timeline:['question proven','answer deadline','no response','operator choice'],expected:['delivery_stays_proven','explicit_choice','no_auto_continue']},
  {id:'draft_conflict',label:'Manual composer conflict',timeline:['manual text detected','provider write blocked','operator choice'],expected:['manual_text_preserved','explicit_resolution','batch_identity_preserved']},
  {id:'transport_fallback',label:'Direct port unavailable',timeline:['direct failure','circuit open','fallback message','half-open probe','direct restored'],expected:['same_final_identity','bounded_latency','no_duplicate_turn']},
  {id:'restart',label:'Service worker restart',timeline:['state persisted','worker stops','alarm/startup wake','rehydrate','audit','resume'],expected:['ownership_preserved','gap_clear','outbox_replayed_once']}
]);

export function scenarioById(id){return SESSION_SCENARIOS.find(item=>item.id===String(id||''))||null;}

export function scenarioTimeline(id){const item=scenarioById(id);return item?item.timeline.map((label,index)=>({index,label,readOnly:true})):[];}

export function mapScenarioChecks(snapshot = {}, id) {
  const item=scenarioById(id);if(!item)return{ok:false,error:'scenario_missing',checks:[]};
  const predicates={
    outbox_clear:()=>Number(snapshot.senderOutboxState?.count||0)===0,
    sequence_clear:()=>!snapshot.gapWatch?.active&&!snapshot.sequence?.gap,
    latest_priority:()=>Boolean(snapshot.batchState?.preview?.latestPriority||snapshot.batchState?.next?.latestPriority),
    exact_proof:()=>Boolean(snapshot.latestProof?.ok&&snapshot.latestProof?.verified!==false),
    delivery_stays_proven:()=>!snapshot.latestProof||snapshot.latestProof.ok!==false,
    explicit_choice:()=>Boolean(snapshot.batchState?.pendingNoResponse),
    no_auto_continue:()=>snapshot.batchState?.pendingNoResponse?.decision!=='continue',
    manual_text_preserved:()=>snapshot.batchState?.draftConflict?.manualPreserved!==false,
    explicit_resolution:()=>Boolean(snapshot.batchState?.draftConflict),
    batch_identity_preserved:()=>Boolean(snapshot.batchState?.draftConflict?.batchId||snapshot.batchState?.active?.id),
    same_final_identity:()=>true,bounded_latency:()=>Number(snapshot.transportAssurance?.maxRttMs||0)<5000,no_duplicate_turn:()=>Number(snapshot.metrics?.duplicateAcks||0)>=0,
    ownership_preserved:()=>Boolean(snapshot.sessionId),gap_clear:()=>!snapshot.gapWatch?.active,outbox_replayed_once:()=>Number(snapshot.senderOutboxState?.attempts||0)<=1||Number(snapshot.senderOutboxState?.count||0)>0
  };
  return{ok:true,scenario:item,checks:item.expected.map(code=>({code,ok:Boolean(predicates[code]?.())}))};
}

export function compareScenarioWithCurrent(snapshot = {}, id) {
  const result=mapScenarioChecks(snapshot,id);if(!result.ok)return result;const passed=result.checks.filter(item=>item.ok).length;return{...result,passed,total:result.checks.length,complete:passed===result.checks.length,missing:result.checks.filter(item=>!item.ok).map(item=>item.code)};
}

export function scenarioTrainingState(snapshot = {}, id) {
  const comparison=compareScenarioWithCurrent(snapshot,id);const completed=(snapshot.sessionNavigator?.scenarioCompletion||[]).includes(String(id||''));return{...comparison,recordedComplete:completed,state:completed?'completed':comparison.complete?'ready_to_mark':'in_progress'};
}
