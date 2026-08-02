import { deriveRecoveryProgress } from './recovery-progress-model.js';

export function deriveRecoveryRunbookConsole(snapshot = {}, now = Date.now()) {
  const progress=deriveRecoveryProgress(snapshot);
  const schedule=snapshot.recoverySchedules?.[0] || null;
  const budget=snapshot.recoveryBudget || {};
  const recovery=snapshot.lastRepair || {};
  const byId=Object.fromEntries((progress.items || []).map(item=>[item.id,item.complete]));
  const steps=[
    { id:'roles', label:'Managed roles', complete:Boolean(byId.sender && byId.receiver) },
    { id:'adapters', label:'Provider adapters', complete:Boolean(byId.adapters) },
    { id:'reconciliation', label:'Lossless reconciliation', complete:Boolean(byId.reconciliation) },
    { id:'storage', label:'Session storage', complete:Boolean(byId.storage) }
  ];
  const current=steps.find(item=>!item.complete) || null;
  const command=snapshot.mode==='blocked' ? 'repair_runtime' : current?.id==='reconciliation' ? 'resume_catch_up' : current ? 'check_live' : snapshot.selfTest?.ok ? '' : 'run_self_test';
  return { state:String(snapshot.mode || 'unknown'), steps, complete:steps.filter(item=>item.complete).length, total:steps.length, current, retryBudget:{ used:Number(budget.used || recovery.attempt || 0), max:Number(budget.max || 3), remaining:Math.max(0,Number(budget.max || 3)-Number(budget.used || recovery.attempt || 0)) }, deadline:schedule ? { kind:schedule.kind, dueInMs:Math.max(0,Number(schedule.dueAt || 0)-now) } : null, automaticAllowed:!snapshot.deliveryPolicy?.active && snapshot.storagePressure?.level!=='critical', command, reason:String(snapshot.rootCause?.code || recovery.reason || 'healthy') };
}