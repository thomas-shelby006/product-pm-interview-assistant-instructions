import { deriveGoalCoverageMatrix, prioritizeGoalGaps, derivePhaseCoverage } from './session-navigator-goal-model.js';
import { bookmarkReviewQueue } from './session-navigator-bookmark-model.js';

function unresolvedDecisions(snapshot={}){const output=[];if(snapshot.batchState?.pendingNoResponse)output.push({code:'no_response_choice',view:'queue'});if(['unresolved','keep_manual'].includes(String(snapshot.batchState?.draftConflict?.state||'')))output.push({code:'draft_conflict',view:'queue'});if((snapshot.ledger||[]).some(item=>!['proven','archived'].includes(item.state)))output.push({code:'unresolved_finals',view:'queue'});if(snapshot.endGuard?.blocked)output.push({code:'end_guard_blocked',view:'overview'});return output;}

export function deriveUnresolvedDecisionSummary(snapshot = {}) {
  const items=unresolvedDecisions(snapshot);return{items,count:items.length,clear:items.length===0,label:items.length?`${items.length} decision(s) remain`:'No unresolved decisions'};
}

export function deriveMarkerHighlights(snapshot = {}) {
  const rank={needs_review:5,weak_answer:4,metric_gap:3,execution_gap:3,follow_up:2,strong_answer:1};return(snapshot.operatorMarkers||[]).map(item=>({...item,weight:rank[item.category]||1})).sort((a,b)=>b.weight-a.weight||Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,12);
}

export function deriveNextPracticePlan(snapshot = {}) {
  const gaps=prioritizeGoalGaps(snapshot).slice(0,3);const review=bookmarkReviewQueue(snapshot).slice(0,3);const markers=deriveMarkerHighlights(snapshot).filter(item=>item.category!=='strong_answer').slice(0,3);const steps=[];
  for(const item of gaps)steps.push({id:`goal:${item.id}`,label:`Practice ${item.label}`,reason:`${item.remaining} coverage target(s) remain`,source:'goal'});
  for(const item of review)steps.push({id:`bookmark:${item.id}`,label:item.label||`Review ${item.category}`,reason:'Evidence bookmark has not been reviewed',source:'bookmark'});
  for(const item of markers)steps.push({id:`marker:${item.id}`,label:`Revisit ${item.category.replaceAll('_',' ')}`,reason:`Marked during the mock interview`,source:'marker'});
  return{steps:steps.slice(0,7),empty:steps.length===0};
}

export function deriveGuidedDebrief(snapshot = {}) {
  const decisions=deriveUnresolvedDecisionSummary(snapshot),coverage=deriveGoalCoverageMatrix(snapshot),phaseCoverage=derivePhaseCoverage(snapshot),markers=deriveMarkerHighlights(snapshot),practice=deriveNextPracticePlan(snapshot);
  const exportReady=decisions.clear&&Number(snapshot.senderOutboxState?.count||0)===0&&!snapshot.batchState?.active;
  return{state:exportReady?'ready':'blocked',exportReady,decisions,coverage,phaseCoverage,markers,practice,sections:[{id:'delivery',complete:(snapshot.ledger||[]).every(item=>['proven','archived'].includes(item.state))},{id:'decisions',complete:decisions.clear},{id:'evidence',complete:markers.length>0||bookmarkReviewQueue(snapshot).length>0},{id:'practice',complete:!practice.empty}]};
}

export function buildMetadataDebriefExport(snapshot = {}, now = Date.now()) {
  const model=deriveGuidedDebrief(snapshot);return{schema:'pmia.navigator.debrief.v1',sessionId:String(snapshot.sessionId||''),exportedAt:Number(now),metrics:{deliverySuccessRate:Number(snapshot.metrics?.deliverySuccessRate||0),answerAvailabilityRate:Number(snapshot.metrics?.answerAvailabilityRate||0),questions:Number(snapshot.metrics?.finalsObserved||0),markers:model.markers.length,goals:model.coverage.total,goalCoveragePercent:model.coverage.percent,phaseCoveragePercent:model.phaseCoverage.percent},unresolved:model.decisions.items.map(item=>item.code),practice:model.practice.steps.map(item=>({id:item.id,label:item.label,reason:item.reason,source:item.source})),privacy:{containsQuestionText:false,containsAnswerText:false,containsSetupContext:false,containsCredentials:false,containsRawUrls:false}};
}
