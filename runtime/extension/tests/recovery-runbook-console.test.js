import test from 'node:test'; import assert from 'node:assert/strict'; import { deriveRecoveryRunbookConsole } from '../dashboard/recovery-runbook-console-model.js';
test('Cycle 7 recovery console exposes one current action and retry budget',()=>{ const value=deriveRecoveryRunbookConsole({mode:'repairing',lastRepair:{phase:'repairing',checks:{sender:true,receiver:true,adapters:false,reconciliation:false,batch:true,storage:true}},recoveryBudget:{used:1,max:3},recoverySchedules:[{kind:'verify',dueAt:1100}],deliveryPolicy:{active:false},storagePressure:{level:'normal'}},100); assert.equal(value.current.id,'adapters'); assert.equal(value.retryBudget.remaining,2); assert.equal(value.command,'check_live'); assert.equal(value.deadline.dueInMs,1000); });
test('recovery console reads the current recovery budget snapshot schema',()=>{
  const value=deriveRecoveryRunbookConsole({
    mode:'repairing',
    recoveryBudget:{state:'used',automaticUsed:2,maxAutomatic:4,remaining:2},
    deliveryPolicy:{active:false},
    storagePressure:{level:'normal'}
  },100);
  assert.deepEqual(value.retryBudget,{used:2,max:4,remaining:2});
  assert.equal(value.automaticAllowed,true);
});

test('recovery console blocks automatic repair when the budget is exhausted',()=>{
  const value=deriveRecoveryRunbookConsole({
    mode:'repairing',
    recoveryBudget:{state:'exhausted',automaticUsed:4,maxAutomatic:4,remaining:0},
    deliveryPolicy:{active:false},
    storagePressure:{level:'normal'}
  },100);
  assert.deepEqual(value.retryBudget,{used:4,max:4,remaining:0});
  assert.equal(value.automaticAllowed,false);
});
