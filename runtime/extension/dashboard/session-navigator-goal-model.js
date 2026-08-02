function coveredQuestions(snapshot={},goalId){const coverage=snapshot.sessionNavigator?.coverage||{};return Object.entries(coverage).filter(([,ids])=>(ids||[]).includes(goalId)).map(([id])=>id);}

export function deriveGoalCoverageMatrix(snapshot = {}) {
  const ledgerIds=new Set((snapshot.ledger||[]).map(item=>String(item.id||'')));const goals=(snapshot.sessionNavigator?.goals||[]).map(goal=>{const ids=coveredQuestions(snapshot,goal.id).filter(id=>ledgerIds.has(id));const target=Math.max(1,Number(goal.targetCount||1));return{...goal,coveredCount:ids.length,questionIds:ids,remaining:Math.max(0,target-ids.length),percent:Math.min(100,Math.round(ids.length/target*100)),complete:ids.length>=target};});
  return{goals,complete:goals.filter(item=>item.complete).length,total:goals.length,percent:goals.length?Math.round(goals.filter(item=>item.complete).length/goals.length*100):100};
}

export function validateCompetencyTarget(goal = {}) {
  const id=String(goal.id||'').trim(),label=String(goal.label||'').trim();if(!id||!label)return{ok:false,error:'goal_identity_required'};const target=Math.max(1,Math.min(50,Number(goal.targetCount||1)));return{ok:true,goal:{id:id.slice(0,120),label:label.slice(0,160),targetCount:target,priority:['low','normal','high','critical'].includes(String(goal.priority))?String(goal.priority):'normal',phases:[...new Set((goal.phases||[]).map(String))].slice(0,6)}};
}

export function validateCoverageTag(snapshot = {}, questionId, goalIds = []) {
  const id=String(questionId||'');if(!(snapshot.ledger||[]).some(item=>String(item.id||'')===id))return{ok:false,error:'coverage_question_missing'};const known=new Set((snapshot.sessionNavigator?.goals||[]).map(goal=>goal.id));const values=[...new Set((goalIds||[]).map(String))];if(values.some(value=>!known.has(value)))return{ok:false,error:'coverage_goal_missing'};return{ok:true,questionId:id,goalIds:values};
}

export function prioritizeGoalGaps(snapshot = {}) {
  const rank={critical:4,high:3,normal:2,low:1};return deriveGoalCoverageMatrix(snapshot).goals.filter(item=>!item.complete).sort((a,b)=>(rank[b.priority]-rank[a.priority])||(b.remaining-a.remaining)||a.label.localeCompare(b.label)).map((item,index)=>({...item,rank:index+1,recommendedAction:{view:'queue',anchor:'questionNavigator',label:`Tag or practice ${item.label}`}}));
}

export function derivePhaseCoverage(snapshot = {}) {
  const phases=['setup','ready','active','paused','debrief','ended'];const history=snapshot.liveSession?.history||[];const visited=new Set([snapshot.liveSession?.phase,...history.map(item=>item.phase)].filter(Boolean));return{items:phases.map(id=>({id,covered:visited.has(id)})),covered:phases.filter(id=>visited.has(id)).length,total:phases.length,percent:Math.round(phases.filter(id=>visited.has(id)).length/phases.length*100)};
}
