export function deriveSessionWizard(snapshot = {}, stage = 'start') {
  if(stage==='end'){
    const counts=snapshot.endGuard?.counts || {};
    const commands=Array.isArray(snapshot.commandJournal) ? snapshot.commandJournal : [];
    const exported=commands.some(item=>item.command==='export_session' && item.result?.ok !== false);
    const supportChecked=commands.some(item=>item.command==='export_support_bundle' && item.result?.ok !== false) || snapshot.production?.diagnostics?.privacy?.safe === true;
    const steps=[
      { id:'delivery', label:'Resolve or archive protected finals', complete:Number(counts.actionable || 0)===0 && Number(counts.inFlight || 0)===0, command:'resume_catch_up' },
      { id:'outbox', label:'Persist the sender outbox', complete:Number(counts.unpersisted || 0)===0, command:'retry_outbox' },
      { id:'export', label:'Export session evidence', complete:exported, command:'export_session' },
      { id:'privacy', label:'Verify privacy-safe support state', complete:supportChecked, command:'export_support_bundle' },
      { id:'end', label:'Prepare exact session end', complete:Boolean(snapshot.endGuard?.preparedAt), command:'prepare_end_session' }
    ];
    return { stage:'end', title:'End and handoff', steps, complete:steps.filter(item=>item.complete).length, total:steps.length, current:steps.find(item=>!item.complete) || null, ready:steps.every(item=>item.complete) };
  }
  const preflight=snapshot.preflightWizard || {};
  const steps=(preflight.steps || []).map(item=>({ id:item.id, label:item.label, complete:Boolean(item.complete), command:item.command || '' }));
  const profile=snapshot.production?.operatingProfile || {};
  steps.push({ id:'profile', label:`Confirm ${profile.label || profile.id || 'Balanced'} operating profile`, complete:Boolean(snapshot.productionControls?.operatingProfile), command:'apply_operating_profile' });
  return { stage:'start', title:'Start mock interview', steps, complete:steps.filter(item=>item.complete).length, total:steps.length, current:steps.find(item=>!item.complete) || null, ready:steps.length>0 && steps.every(item=>item.complete) };
}