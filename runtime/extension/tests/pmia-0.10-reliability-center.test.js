import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveCommandHealth, deriveReplayGuard, deriveRouteTransition, deriveSessionSafety,
  deriveBacklogConfidence, deriveTriageSummary, deriveRecoveryEta, deriveChoiceFreshness,
  deriveDockDensity, deriveDisabledActions, deriveIncidentTrend, deriveMilestoneQuality,
  deriveFairnessInspector, deriveStorageReclaim, deriveWakeHistory, deriveProofCoverage,
  deriveKeyboardReadiness, deriveReleaseChecklist, derivePacingMonitor, deriveEvidenceSummary,
  deriveReliabilityCenter
} from '../dashboard/reliability-center-model.js';

const base={
  ledgerCounts:{total:3,proven:3,unresolved:0},
  sender:{provider:'chatgpt',connected:true,phase:'ready'},receiver:{provider:'chatgpt',connected:true,phase:'ready'},
  production:{diagnostics:{privacy:{safe:true}},routeReadiness:{route:'chatgpt -> chatgpt',ready:true},releaseHandoff:{ready:true,gates:[{ok:true}]}},
  liveSession:{phase:'active'},contextArmed:true,selfTest:{ok:true},deliveryPolicy:{active:false},
  commandReachability:{registeredCount:80,errors:[]},commandJournal:[],incidents:{items:[],hiddenCount:0}
};

test('Improvement 51: Command Health Matrix summarizes route ownership',()=>assert.equal(deriveCommandHealth(base).state,'healthy'));
test('Improvement 52: Replay Guard exposes pending, replayed, and failed operations',()=>assert.match(deriveReplayGuard({...base,commandJournal:[{replayCount:2,result:{ok:false}}]}).detail,/2 replayed/));
test('Improvement 53: Route Transition Preview protects active batches',()=>assert.equal(deriveRouteTransition({...base,previousRoute:{route:'a'},production:{...base.production,routeReadiness:{route:'b'}} ,batchState:{active:{questionCount:1}}}).state,'protected'));
test('Improvement 54: Session Safety Summary counts unresolved choice and outbox',()=>assert.match(deriveSessionSafety({...base,operatorChoice:{id:'c'},senderOutboxState:{count:2}}).detail,/2 outbox/));
test('Improvement 55: Backlog Confidence identifies the dominant observed delay',()=>assert.match(deriveBacklogConfidence({...base,livePerformanceForecast:{confidence:'high',providerProofP90Ms:1000,internalRenderMs:5}}).detail,/provider/));
test('Improvement 56: Triage View Summary exposes every saved view count',()=>assert.match(deriveTriageSummary({...base,inboxTriage:{counts:{urgent:1,stale:2,deferred:3,pinned:4,follow_up:5,proof_pending:6}}}).detail,/proof pending 6/));
test('Improvement 57: Recovery ETA explains deadline and retry budget',()=>assert.match(deriveRecoveryEta({...base,recoveryProgress:{state:'running',nextDueAt:5000},recoveryBudget:{remaining:2}},1000).detail,/4s/));
test('Improvement 58: Choice Freshness detects stale visible fingerprints',()=>assert.equal(deriveChoiceFreshness({...base,operatorChoice:{fingerprint:'a'},choiceWorkspace:{fingerprint:'b'}}).state,'stale'));
test('Improvement 59: Action Dock density expands only for attention',()=>assert.equal(deriveDockDensity(base).state,'compact'));
test('Improvement 60: Disabled-action explanations show reasons',()=>assert.match(deriveDisabledActions({...base,commandAvailability:{repair_runtime:{enabled:false,reason:'role missing'}}}).detail,/role missing/));
test('Improvement 61: Incident Trend summarizes bounded severity history',()=>assert.equal(deriveIncidentTrend({...base,incidents:{items:[{severity:'critical'},{severity:'info'}],hiddenCount:1}}).state,'attention'));
test('Improvement 62: Milestone Quality reports completed safety milestones',()=>assert.match(deriveMilestoneQuality({...base,preflight:{ready:true},checkpoint:{complete:true}}).detail,/4\/4/));
test('Improvement 63: Batch Fairness Inspector exposes starvation promotion',()=>assert.equal(deriveFairnessInspector({...base,batchState:{scheduling:{reason:'starvation_promoted',waitMs:90000}}}).state,'promoted'));
test('Improvement 64: Storage Reclaim Simulator protects actionable ownership',()=>assert.match(deriveStorageReclaim({...base,storageAccounting:{total:100,actionable:70,telemetry:10,snapshots:10,proven:10},storagePressure:{targetBytes:50}}).detail,/actionable ownership stays protected/));
test('Improvement 65: Lifecycle Wake History reports failed wakes',()=>assert.equal(deriveWakeHistory({...base,wakeHistory:[{reason:'startup',outcome:'ok'},{reason:'alarm',outcome:'failed'}]}).state,'review'));
test('Improvement 66: Proof Coverage Matrix distinguishes partial reports',()=>assert.equal(deriveProofCoverage({...base,partialProofs:[{id:'a'}]}).state,'partial'));
test('Improvement 67: Keyboard Readiness surfaces conflicts and gesture expiry',()=>assert.equal(deriveKeyboardReadiness({...base,shortcutConflicts:{conflicts:['x']},focusGestureState:{expired:true}}).state,'attention'));
test('Improvement 68: Release Readiness Checklist reflects exact gate state',()=>assert.equal(deriveReleaseChecklist(base).state,'ready'));
test('Improvement 69: Interview Pacing Monitor detects queue acceleration without content analysis',()=>assert.equal(derivePacingMonitor({...base,ledgerCounts:{unresolved:3},livePerformanceForecast:{intakePerMinute:2,proofPerMinute:1}}).state,'accelerating'));
test('Improvement 70: Evidence Export Summary states included and excluded metadata',()=>{const detail=deriveEvidenceSummary({...base,releaseEvidence:{commit:'abc'}}).detail;assert.match(detail,/question text/);assert.match(detail,/command results/);});
test('Reliability Center groups all twenty improvements into five operator sections',()=>{const result=deriveReliabilityCenter(base,100);assert.equal(result.total,20);assert.equal(result.groups.length,5);assert.equal(result.groups.every(group=>group.items.length===4),true);});
