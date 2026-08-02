import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveOperationsLab } from '../dashboard/operations-lab-model.js';

const base={
  sessionId:'s',mode:'active',
  ledger:[{id:'q1',state:'proven',createdAt:100,batchId:'b1',proof:{recordId:'u1',observedAt:900}}],
  ledgerCounts:{total:1,proven:1,unresolved:0,pending:0,inFlight:0},
  sender:{provider:'chatgpt',connected:true,phase:'ready',heartbeatAt:900,transportLane:{state:'closed',lastMode:'direct',lastRttMs:20,epoch:2,handshakeReady:true}},
  receiver:{provider:'chatgpt',connected:true,phase:'ready',composerReady:true,heartbeatAt:900,transportLane:{state:'closed',lastMode:'direct',lastRttMs:30,epoch:2,handshakeReady:true}},
  liveSession:{phase:'active',startedAt:100},contextArmed:true,
  selfTest:{ok:true,completedAt:900,trust:{state:'active'}},dashboardConnections:1,
  livePerformanceForecast:{state:'stable',intakePerMinute:1,proofPerMinute:1,confidence:'high',estimatedCatchUpMs:0},
  production:{diagnostics:{privacy:{safe:true},support:{complete:true}},releaseHandoff:{ready:true,gates:[{id:'automated',ok:true}],failed:[]},operatingProfile:{id:'balanced'},decisionCenter:{primary:null,items:[]},routeReadiness:{issues:[]},liveScorecard:{}},
  incidents:{items:[],hiddenCount:0},deliveryPolicy:{active:false},batchState:{active:null,next:null},
  partialProofs:[],wakeHistory:[],timeline:[],commandJournal:[],markers:[]
};
const derive=(patch={},options={})=>deriveOperationsLab({...base,...patch},{now:1000,...options});
const find=(lab,id)=>lab.groups.flatMap(group=>group.items).find(entry=>entry.id===id);
const check=(cycle,id,expected,patch={},options={})=>test(`Cycle ${cycle}: ${id}`,()=>{const value=find(derive(patch,options),id);assert.ok(value);assert.match(`${value.state} ${value.detail} ${value.metric}`,expected);});

test('Operations Lab exposes ten stable views and forty content-free capabilities',()=>{const lab=derive();assert.deepEqual(lab.views.map(view=>view.id),['flow','transport','proof','recovery','closure','signals','forecast','plans','evidence','review']);assert.equal(lab.total,40);assert.equal(lab.visibleItems.length,4);assert.equal(lab.privacy.safe,true);});
check(91,'flow_map',/proven 1/);
check(92,'aging_bands',/breached 1/,{ledger:[{id:'q',state:'persisted',createdAt:0}],ledgerCounts:{unresolved:1}},{now:120000});
check(93,'decision_sla',/active.*Decision age 200 ms/,{operatorChoice:{id:'c',createdAt:100,expiresAt:500}},{now:300});
check(94,'bottleneck',/transport.*port timeout/,{rootCause:{owner:'transport',code:'port_timeout'}});
check(95,'transport_hops',/epoch 2/);
check(96,'circuit_countdown',/waiting.*400 ms/,{sender:{...base.sender,transportLane:{...base.sender.transportLane,nextProbeAt:1400}}});
check(97,'profile_explanation',/balanced/);
check(98,'degraded_mode',/queue[_ ]only.*provider drift/i,{deliveryPolicy:{active:true,reason:'provider_drift'}});
check(99,'provenance',/1 ledger entries/);
check(100,'partial_repair',/1 missing and 1 mismatched/,{partialProofs:[{missingIds:['q2'],mismatchedIds:['q3']} ]});
check(101,'duplicate_capture',/1 rendered record identity collision/,{ledger:[{id:'a',state:'proven',proof:{recordId:'u'}},{id:'b',state:'proven',proof:{recordId:'u'}}]});
check(102,'export_readiness',/ready.*Privacy safe/);
check(103,'checkpoint_timeline',/1 bounded checkpoint/,{wakeHistory:[{at:900}]});
check(104,'recovery_simulation',/network loss.*transport/i,{}, {scenario:'network_loss'});
check(105,'safe_action_checklist',/1\/2 recovery steps complete/,{recoveryProgress:{steps:[{label:'Inspect',complete:true},{label:'Verify',complete:false}]}});
check(106,'attention_budget',/3 simultaneous|3 signals/,{operatorChoice:{id:'c'},incidents:{items:[{visible:true},{visible:true}]}});
check(107,'pacing_signal',/Intake 1\/min, proof 1\/min/);
check(108,'silence_window',/capture issue/i,{liveOperations:{silence:{state:'capture_issue'}}});
check(109,'alert_suppression',/2 lower-priority/,{incidents:{items:[],hiddenCount:2,quietMode:true}});
check(110,'closure_preview',/3 ownership barrier/,{endGuard:{counts:{actionable:1,inFlight:1,unpersisted:1}}});
check(131,'change_radar',/Latest 2 events/,{timeline:[{type:'final_persisted'},{type:'final_persisted'}]});
check(132,'confidence_ledger',/high.*100% proof/);
check(133,'attention_saturation',/overloaded.*7 simultaneous/,{operatorChoice:{id:'c'},incidents:{items:Array.from({length:6},()=>({visible:true}))}});
check(134,'decision_queue',/2 ranked production decision/,{production:{...base.production,decisionCenter:{items:[{code:'repair'},{code:'verify'}]}}});
check(135,'queue_projection',/five-minute unresolved projection is 6/,{ledger:[{id:'q',state:'persisted',createdAt:900}],livePerformanceForecast:{state:'falling_behind',intakePerMinute:2,proofPerMinute:1}});
check(136,'proof_eta',/Estimated final proof horizon 500 ms/,{ledger:[{id:'q',state:'persisted'}],deliveryForecast:{proofP95Ms:500}});
check(137,'recovery_eta',/1 step\(s\) remain/,{recoveryProgress:{steps:[{complete:false}],deadline:{dueInMs:2000}}});
check(138,'interview_pace',/Phase active/,{liveOperations:{clock:{elapsedMs:5000}}});
check(139,'route_switch_plan',/2 prerequisite/,{production:{...base.production,routeReadiness:{issues:['composer_missing','self_test_stale']}}});
check(140,'containment_exit_plan',/Keep persistence active/,{deliveryPolicy:{active:true,reason:'provider_drift'},rootCause:{code:'provider_drift'}});
check(141,'resume_plan',/2 final\(s\) retained/,{crashResume:{visible:true,unresolved:2},resumeGuard:{allowed:false,reason:'verification_required'}});
check(142,'end_session_plan',/Resolve or explicitly archive 2/,{endGuard:{counts:{actionable:2}}});
check(143,'evidence_coverage',/1\/1 release gates/);
check(144,'missing_proof_matrix',/1 unresolved ledger item/,{ledger:[{id:'q',state:'persisted'}]});
check(145,'support_bundle_preview',/Metadata-only export is privacy-safe/);
check(146,'release_delta',/1 release gate\(s\) differ/,{production:{...base.production,releaseHandoff:{gates:[{id:'browser',ok:false}]}}});
check(147,'milestone_trail',/2 bounded marker/,{markers:[{id:'m1'},{id:'m2'}]});
check(148,'incident_outcomes',/2 total incident.*1 acknowledged/,{incidents:{items:[{acknowledgedAt:10,visible:true},{visible:false}]}});
check(149,'decision_effectiveness',/1 successful, 1 failed/,{commandJournal:[{result:{ok:true}},{result:{ok:false}}]});
check(150,'next_mock_checklist',/finish protected delivery/,{ledger:[{id:'q',state:'persisted'}]});

test('Operations Lab keeps scenarios local and content-free',()=>{const lab=derive({latestFinal:{text:'SECRET QUESTION'},ledger:[{id:'q',state:'persisted',envelope:{text:'SECRET QUESTION'}}]},{scenario:'receiver_reload'});assert.equal(lab.scenario,'receiver_reload');assert.equal(lab.total,40);assert.equal(lab.privacy.safe,true);assert.doesNotMatch(JSON.stringify(lab),/SECRET QUESTION/);});
