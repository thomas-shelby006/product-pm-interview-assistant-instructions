const STEPS = Object.freeze(['freeze_commands','export_optional','clear_registry','clear_pilot','clear_logs','close_windows','remove_profile','verify_cleanup']);
function clone(value){ return JSON.parse(JSON.stringify(value)); }
export function beginCleanupTransaction({ sessionId='', now=Date.now(), id='' }={}) {
  return { id:String(id||`cleanup-${sessionId}-${now}`),sessionId:String(sessionId),state:'running',current:0,steps:STEPS.map(name=>({name,state:'pending',at:0,error:''})),startedAt:now,completedAt:0 };
}
export function recordCleanupStep(transaction={},name='',result={},now=Date.now()) {
  const value=clone(transaction); const index=value.steps?.findIndex(step=>step.name===name)??-1;
  if(index<0) return { ok:false,error:'cleanup_step_unknown',transaction:value };
  if(value.state==='complete') return { ok:value.steps[index]?.state==='complete',error:value.steps[index]?.state==='complete'?'':'cleanup_already_complete',transaction:value };
  const nextIndex=value.steps.findIndex(step=>step.state!=='complete');
  if(index!==nextIndex) return { ok:false,error:'cleanup_step_out_of_order',expected:value.steps[nextIndex]?.name||'',transaction:value };
  if(value.steps[index].state==='failed'&&result?.retry!==true) return { ok:false,error:'cleanup_retry_required',transaction:value };
  value.steps[index]={ ...value.steps[index],state:result?.ok===false?'failed':'complete',at:now,error:result?.ok===false?String(result.error||'cleanup_failed'):'' };
  value.current=result?.ok===false?index:index+1;
  if(result?.ok===false) value.state='failed'; else if(value.steps.every(step=>step.state==='complete')){ value.state='complete';value.completedAt=now; } else value.state='running';
  return { ok:result?.ok!==false,transaction:value };
}
export function resumeCleanupTransaction(transaction={}) {
  const value=clone(transaction); const next=value.steps?.find(step=>step.state!=='complete');
  return { resumable:value.state!=='complete'&&Boolean(next),nextStep:next?.name||'',requiresRetry:next?.state==='failed',transaction:value };
}
export function cleanupSteps(){ return [...STEPS]; }
