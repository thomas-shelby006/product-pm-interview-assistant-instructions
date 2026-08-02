function unresolved(snapshot={}){return(snapshot.ledger||[]).filter(item=>!['proven','archived'].includes(String(item.state)));}

export function deriveCurrentNextBoundary(snapshot = {}) {
  const active=snapshot.batchState?.active||null,next=snapshot.batchState?.next||null,answer=snapshot.answerState||{};
  return{current:active?{id:String(active.id||active.batchId||''),count:Number(active.questionCount||active.memberIds?.length||0),state:String(active.state||'active'),answerState:String(answer.state||'waiting')} : null,next:next?{id:String(next.id||next.batchId||''),count:Number(next.questionCount||next.memberIds?.length||0),state:String(next.state||'waiting')} : null};
}

export function deriveHandoffBlockers(snapshot = {}) {
  const blockers=[];const boundary=deriveCurrentNextBoundary(snapshot);const conflict=String(snapshot.batchState?.draftConflict?.state||'');
  if(boundary.current&& !['complete','no_response','timed_out','cancelled'].includes(boundary.current.answerState))blockers.push({code:'answer_not_terminal',owner:'answer'});
  if(snapshot.batchState?.pendingNoResponse)blockers.push({code:'no_response_choice_required',owner:'operator'});
  if(['unresolved','keep_manual'].includes(conflict))blockers.push({code:'draft_conflict_required',owner:'operator'});
  if(snapshot.deliveryPolicy?.active)blockers.push({code:snapshot.deliveryPolicy.reason||'delivery_contained',owner:'runtime'});
  if(snapshot.consistencyAudit?.ok===false)blockers.push({code:snapshot.consistencyAudit.reason||'consistency_failed',owner:'runtime'});
  if((snapshot.senderOutboxState?.count||0)>0)blockers.push({code:'sender_outbox_pending',owner:'sender'});
  return blockers;
}

export function deriveAnswerAcknowledgementHandoff(snapshot = {}) {
  const ack=snapshot.batchState?.answerAcknowledgement||null;const handoff=snapshot.batchState?.answerHandoff||null;
  return{required:Boolean(handoff?.requiresAcknowledgement&&!ack?.acknowledgedAt),acknowledgedAt:Number(ack?.acknowledgedAt||0),batchId:String(handoff?.batchId||ack?.batchId||''),summary:String(handoff?.summary||''),state:String(handoff?.state||'idle')};
}

export function deriveReadyToAdvance(snapshot = {}) {
  const blockers=deriveHandoffBlockers(snapshot);const ack=deriveAnswerAcknowledgementHandoff(snapshot);if(ack.required)blockers.push({code:'answer_acknowledgement_required',owner:'operator'});
  const boundary=deriveCurrentNextBoundary(snapshot);const ready=blockers.length===0&&Boolean(boundary.next||unresolved(snapshot).length===0);
  return{ready,blockers,boundary,acknowledgement:ack,label:ready?(boundary.next?'Ready for next batch':'Session caught up'):'Handoff blocked',action:ready&&boundary.next?{command:'submit_now',label:'Advance to next batch'}:blockers[0]?.owner==='operator'?{view:'queue',label:'Resolve required choice'}:{command:'check_live',label:'Recheck runtime'}};
}

export function deriveHandoffBoard(snapshot = {}) {
  const result=deriveReadyToAdvance(snapshot);return{...result,unresolvedCount:unresolved(snapshot).length,currentLabel:result.boundary.current?`${result.boundary.current.count} question(s) · ${result.boundary.current.answerState}`:'No active batch',nextLabel:result.boundary.next?`${result.boundary.next.count} protected question(s)`:'No next batch'};
}
