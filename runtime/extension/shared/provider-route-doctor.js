function roleState(role = {}) {
  const missing=role.adapterCapabilities?.missingRequired || [];
  const probation=role.adapterCapabilityProbation || {};
  const scheduler=role.schedulerState || {};
  const issues=[];
  if(!role.connected) issues.push('runtime_missing');
  if(role.composerReady === false) issues.push('composer_missing');
  if(missing.length) issues.push('adapter_capability_missing');
  if(probation.writeSafe === false) issues.push('provider_write_unsafe');
  if(scheduler.phase && scheduler.phase !== 'idle') issues.push('provider_wait_active');
  return { provider:String(role.provider || ''), phase:String(role.phase || 'missing'), ready:Boolean(role.connected && role.phase==='ready' && role.composerReady && !missing.length && probation.writeSafe !== false), issues, missing:[...missing], sendReady:role.submitReadiness?.ready !== false, visibility:String(role.pageVisibility || scheduler.visibilityState || 'unknown'), wakeSource:String(scheduler.wakeSource || '') };
}
export function deriveProviderRouteDoctor(snapshot = {}) {
  const sender=roleState(snapshot.sender); const receiver=roleState(snapshot.receiver);
  const issues=[...new Set([...sender.issues.map(code=>`sender:${code}`),...receiver.issues.map(code=>`receiver:${code}`)])];
  const command=issues.some(value=>value.includes('runtime_missing')) ? 'repair_runtime' : issues.some(value=>value.includes('composer_missing')||value.includes('adapter_capability')) ? 'check_live' : issues.some(value=>value.includes('provider_write_unsafe')) ? 'run_self_test' : '';
  return { state:issues.length ? 'attention' : 'ready', route:`${sender.provider || '?'} → ${receiver.provider || '?'}`, sender, receiver, issues, recommendedCommand:command, explanation:issues.length ? `${issues.length} route condition${issues.length===1?'':'s'} require attention.` : 'Both provider roles expose healthy composer, adapter, and write evidence.' };
}