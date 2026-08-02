export function deriveRecoveryRunbookConsole(snapshot = {}, now = Date.now()) {
  const progress=snapshot.recoveryProgress || {};
  const schedule=snapshot.recoverySchedules?.[0] || null;
  const budget=snapshot.recoveryBudget || {};
  const recovery=snapshot.lastRepair || {};
  const steps=[
    { id:'roles', label:'Managed roles', complete:Boolean(progress.checks?.sender && progress.checks?.receiver) },
    { id:'adapters', label:'Provider adapters', complete:Boolean(progress.checks?.adapters) },
    { id:'reconciliation', label:'Lossless reconciliation', complete:Boolean(progress.checks?.reconciliation) },
    { id:'storage', label:'Session storage', complete:Boolean(progress.checks?.storage) }
  ];
  const current=steps.find(item=>!item.complete) || null;
  const command=snapshot.mode==='blocked' ? 'repair_runtime' : current?.id==='reconciliation' ? 'resume_catch_up' : current ? 'check_live' : snapshot.selfTest?.ok ? '' : 'run_self_test';
  return { state:String(snapshot.mode || 'unknown'), steps, complete:steps.filter(item=>item.complete).length, total:steps.length, current, retryBudget:{ used:Number(budget.used || recovery.attempt || 0), max:Number(budget.max || 3), remaining:Math.max(0,Number(budget.max || 3)-Number(budget.used || recovery.attempt || 0)) }, deadline:schedule ? { kind:schedule.kind, dueInMs:Math.max(0,Number(schedule.dueAt || 0)-now) } : null, automaticAllowed:!snapshot.deliveryPolicy?.active && snapshot.storagePressure?.level!=='critical', command, reason:String(snapshot.rootCause?.code || recovery.reason || 'healthy') };
}