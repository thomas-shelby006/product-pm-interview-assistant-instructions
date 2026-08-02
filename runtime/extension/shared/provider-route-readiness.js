function capability(role = {}) {
  const adapter=role.adapterCapabilities||{},probation=role.adapterCapabilityProbation||{},drift=role.adapterCapabilityDrift||{};
  return { provider:String(role.provider||''),connected:role.connected!==false,phase:String(role.phase||''),composerReady:role.composerReady!==false,complete:Boolean(adapter.complete),required:Array.isArray(adapter.required)?[...adapter.required]:[],missing:Array.isArray(adapter.missingRequired)?[...adapter.missingRequired]:[],writeSafe:probation.writeSafe!==false,probation:String(probation.state||'unknown'),drift:String(drift.state||'unknown'),removed:Array.isArray(drift.removed)?[...drift.removed]:[] };
}
export function deriveProviderRouteReadiness(snapshot = {}) {
  const sender=capability(snapshot.sender),receiver=capability(snapshot.receiver),blockers=[];
  if(!sender.provider||!receiver.provider) blockers.push('provider_missing');
  if(!sender.connected||sender.phase==='missing') blockers.push('sender_runtime_missing');
  if(!receiver.connected||receiver.phase==='missing') blockers.push('receiver_runtime_missing');
  if(!sender.complete) blockers.push('sender_capability_incomplete'); if(!receiver.complete) blockers.push('receiver_capability_incomplete');
  if(!receiver.composerReady) blockers.push('receiver_composer_not_ready'); if(!receiver.writeSafe) blockers.push('receiver_write_unsafe');
  if(!snapshot.contextArmed) blockers.push('context_not_armed'); if(snapshot.selfTest && snapshot.selfTest.ok!==true) blockers.push('self_test_not_ready');
  if(snapshot.deliveryPolicy?.active) blockers.push('queue_only_active'); if(snapshot.routeTransition?.state==='freeze_required') blockers.push('route_transition_frozen');
  const ready=blockers.length===0;
  const checklist=[{id:'roles',ok:Boolean(sender.provider&&receiver.provider&&sender.connected&&receiver.connected),label:'Both provider roles registered'},{id:'capabilities',ok:sender.complete&&receiver.complete,label:'Required adapter capabilities complete'},{id:'composer',ok:receiver.composerReady,label:'Receiver composer ready'},{id:'write',ok:receiver.writeSafe,label:'Receiver provider writes safe'},{id:'context',ok:Boolean(snapshot.contextArmed),label:'Session context armed'},{id:'delivery',ok:!snapshot.deliveryPolicy?.active,label:'Provider delivery enabled'}];
  const recommendedCommand=blockers.includes('context_not_armed')?'resend_context':blockers.some(value=>value.includes('runtime_missing'))?'repair_runtime':blockers.includes('receiver_write_unsafe')||blockers.includes('self_test_not_ready')?'run_self_test':'check_live';
  return { state:ready?'ready':'blocked',ready,blockers:[...new Set(blockers)],sender,receiver,route:`${sender.provider||'--'} -> ${receiver.provider||'--'}`,checklist,resendEligible:Boolean(sender.connected&&receiver.connected),recommendedCommand };
}
