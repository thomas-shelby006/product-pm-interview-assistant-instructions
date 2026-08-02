function average(values=[]){const list=values.map(Number).filter(Number.isFinite);return list.length?Math.round(list.reduce((a,b)=>a+b,0)/list.length):0;}
function band(value, baseline){if(!value||!baseline)return'unknown';if(value<baseline*.7)return'fast';if(value>baseline*1.35)return'slow';return'on_target';}

export function derivePaceBaseline(snapshot = {}) {
  const samples=(snapshot.metrics?.answerElapsedMs||[]).map(Number).filter(value=>value>0).slice(-20);
  const planned=Math.max(0,Number(snapshot.liveSession?.plannedDurationMs||0));
  const questionCount=Math.max(1,Number(snapshot.metrics?.answersCompleted||0)+Number(snapshot.metrics?.answersNoResponse||0)+Number(snapshot.metrics?.answersTimedOut||0));
  const observed=average(samples); const plannedPerQuestion=planned?Math.round(planned/Math.max(5,questionCount)):0;
  const baseline=observed||plannedPerQuestion||90000;
  return{baselineMs:baseline,observedMs:observed,plannedPerQuestionMs:plannedPerQuestion,sampleCount:samples.length,source:observed?'observed':plannedPerQuestion?'planned':'default'};
}

export function answerDurationBands(snapshot = {}, baseline = derivePaceBaseline(snapshot)) {
  return (snapshot.metrics?.answerElapsedMs||[]).slice(-12).map((value,index)=>({index,valueMs:Number(value||0),band:band(Number(value||0),baseline.baselineMs)}));
}

export function segmentTimeRemaining(snapshot = {}, now = Date.now()) {
  const session=snapshot.liveSession||{},segment=session.segment||{};const duration=Math.max(0,Number(segment.durationMs||0));const started=Math.max(0,Number(segment.startedAt||0));const elapsed=started?Math.max(0,now-started):0;
  return{id:String(segment.id||''),label:String(segment.label||''),durationMs:duration,elapsedMs:elapsed,remainingMs:duration?Math.max(0,duration-elapsed):0,overdue:Boolean(duration&&elapsed>duration),progress:duration?Math.min(100,Math.round(elapsed/duration*100)):0};
}

export function silenceDeviation(snapshot = {}, baseline = derivePaceBaseline(snapshot), now = Date.now()) {
  const last=Math.max(0,Number(snapshot.liveSession?.lastInterviewerActivityAt||0));const silence=last?Math.max(0,now-last):0;const expected=Math.max(15000,Math.round(baseline.baselineMs*.35));
  return{silenceMs:silence,expectedMs:expected,ratio:expected?Number((silence/expected).toFixed(2)):0,state:silence>expected*2?'long':silence>expected?'elevated':'normal'};
}

export function derivePaceGuidance(snapshot = {}, now = Date.now()) {
  const baseline=derivePaceBaseline(snapshot),segment=segmentTimeRemaining(snapshot,now),silence=silenceDeviation(snapshot,baseline,now);const latest=(snapshot.metrics?.answerElapsedMs||[]).at(-1)||0;const latestBand=band(Number(latest),baseline.baselineMs);
  if(segment.overdue)return{state:'behind',label:'Move to the next segment',detail:`${Math.round((segment.elapsedMs-segment.durationMs)/1000)} seconds over plan.`,action:{view:'navigator',tab:'handoff'}};
  if(silence.state==='long')return{state:'attention',label:'Check interviewer activity',detail:'Silence is materially above the session baseline.',action:{command:'mark_interviewer_activity'}};
  if(latestBand==='slow')return{state:'slow',label:'Shorten the next answer',detail:'The latest answer exceeded the observed duration band.',action:{view:'navigator',tab:'goals'}};
  return{state:'on_target',label:'Pace is on target',detail:`Baseline ${Math.round(baseline.baselineMs/1000)} seconds per answer.`,action:null};
}
