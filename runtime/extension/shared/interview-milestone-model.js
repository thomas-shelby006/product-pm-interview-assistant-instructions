const ORDER = Object.freeze(['setup','ready','active','paused','recovery','debrief','ended']);
export function deriveInterviewMilestones(snapshot = {}, now = Date.now()) {
  const phase=String(snapshot.liveSession?.phase || 'setup');
  const history=(snapshot.liveSession?.history || []).map(item=>String(item.phase || '')).filter(Boolean);
  const recovery=Boolean(snapshot.recoveryCard?.visible || ['repairing','degraded','blocked'].includes(snapshot.mode));
  const effective=recovery ? 'recovery' : phase;
  const reached=new Set([...history,phase]); if(recovery) reached.add('recovery');
  const currentIndex=Math.max(0,ORDER.indexOf(effective));
  const items=ORDER.map((id,index)=>({ id, label:id.charAt(0).toUpperCase()+id.slice(1), current:id===effective, completed:reached.has(id) && id!==effective, available:index<=currentIndex || reached.has(id), recoverable:id==='recovery' && recovery }));
  const liveIndex=ORDER.indexOf(phase === 'paused' ? 'paused' : 'active');
  return { phase:effective, items, backToLive:phase==='active'||phase==='paused' ? { view:'overview', anchor:'liveSessionPhase', label:'Back to live' } : null, evaluatedAt:now, currentIndex, liveIndex };
}