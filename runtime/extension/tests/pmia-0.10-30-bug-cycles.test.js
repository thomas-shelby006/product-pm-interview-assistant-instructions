import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMMAND_REGISTRY } from '../shared/operator-command-registry.js';
import { normalizeDashboardCommand } from '../shared/dashboard-protocol.js';
import { auditCommandReachability } from '../shared/command-reachability-audit.js';
import { deriveOperatorChoice } from '../shared/operator-choice-model.js';
import { buildPolicyImpactPreview, validatePolicyImpactConfirmation } from '../shared/policy-impact-preview.js';
import { routeForDecision } from '../shared/cockpit-navigation.js';
import { deriveLiveActionDock } from '../dashboard/live-action-dock-model.js';
import { createDialogFocusCoordinator } from '../dashboard/dialog-focus-coordinator.js';
import { claimRuntimeInjection, releaseRuntimeInjection } from '../shared/runtime-injection-fence.js';
import { derivePrerenderGuard } from '../shared/prerender-guard.js';
import { auditAndRehydrateAlarms } from '../shared/alarm-rehydration.js';
import { beginCleanupTransaction, recordCleanupStep, resumeCleanupTransaction } from '../shared/cleanup-transaction-journal.js';
import { createSenderOutbox } from '../content/sender-outbox.js';
import { DeliveryLedgerIndex } from '../shared/delivery-ledger-index.js';
import { ContiguousSequenceBuffer } from '../shared/contiguous-sequence-buffer.js';
import { ReceiverCreditHysteresis } from '../shared/receiver-credit-hysteresis.js';
import { scheduleFairBatch } from '../shared/fair-batch-scheduler.js';
import { createComposerArbiter } from '../content/composer-arbiter.js';
import { deriveProviderRouteReadiness } from '../shared/provider-route-readiness.js';
import { deriveProviderRouteTransition } from '../shared/provider-route-transition.js';
import { utf8Bytes, buildCompactionPlan } from '../shared/storage-accounting.js';
import { buildSnapshotDelta, applySnapshotDelta } from '../shared/snapshot-delta.js';
import { createRenderScheduler } from '../dashboard/render-scheduler.js';
import { deriveVirtualList } from '../dashboard/virtual-list-model.js';
import { deriveBacklogForecast } from '../shared/backlog-forecast.js';
import { deriveLivePerformanceForecast } from '../shared/live-performance-forecast.js';
import { reanchorMonotonicClock } from '../shared/monotonic-session-clock.js';
import { auditDashboardAccessibility } from '../dashboard/accessibility-audit.js';
import { applyAccessibilityPreferences } from '../dashboard/accessibility-preferences.js';
import { buildSafeSupportBundle, auditSafeSupportBundle } from '../shared/support-bundle.js';
import { deriveReleaseHandoff, buildHandoffManifest } from '../shared/release-handoff.js';

const here = new URL('.', import.meta.url);
const source = relative => readFileSync(new URL(relative, here), 'utf8');
const envelope = (id, seq, provider='chatgpt') => ({ id, sessionId:'s1', sourceProvider:provider, kind:'question', seq, text:`Question ${seq}`, metadata:{}, createdAt:seq });
function memoryStorage(){ const map=new Map(); return { getItem:key=>map.get(key)??null, setItem:(key,value)=>map.set(key,String(value)) }; }
function adapter(){ return { text:'', getComposerText(){ return this.text; }, setComposerText(value){ this.text=value; return true; } }; }
function fakeNode(id='', attrs={}, text=''){ return { id, hidden:false, isConnected:true, textContent:text, value:'', getAttribute:name=>attrs[name]??'', closest:()=>null, focus(){ this.focused=true; } }; }

test('Bug cycle 1: command registry, protocol, visible controls, and controller stay in parity', () => {
  const html=source('../dashboard/index.html'), dashboard=source('../dashboard/dashboard.js'), controller=source('../shared/runtime-pilot-controller.js');
  const audit=auditCommandReachability({ registry:COMMAND_REGISTRY,html,dashboardSource:dashboard,controllerSource:controller });
  assert.equal(audit.ok,true,JSON.stringify(audit.errors));
  for(const command of ['compact_proven','retry_outbox']) assert.equal(normalizeDashboardCommand({sessionId:'s',requestId:`r-${command}`,command})?.command,command);
});

test('Bug cycle 2: duplicate DOM, registry, controller owners, and missing ARIA targets fail the audit', () => {
  const registry=[{id:'x'},{id:'x'}];
  const audit=auditCommandReachability({ registry,html:'<button id="a" aria-controls="missing" data-command="x"></button><div id="a"></div>',dashboardSource:'',controllerSource:"case 'x': break; case 'x': break;" });
  assert.deepEqual(audit.duplicateDomIds,['a']);
  assert.deepEqual(audit.duplicateRegistryIds,['x']);
  assert.deepEqual(audit.duplicateControllerCommands,['x']);
  assert.deepEqual(audit.missingDomTargets,['missing']);
});

test('Bug cycle 3: high-risk command payloads strip unknown fields and require current previews', () => {
  const bad=normalizeDashboardCommand({sessionId:'s',requestId:'r',command:'apply_operating_profile',payload:{profile:'fast',secret:'x'}});
  assert.equal(bad,null);
  const snapshot={sessionId:'s',ledgerCounts:{unresolved:2},batchState:{},deliveryPolicy:{},storagePressure:{},selfTest:{ok:true},receiver:{adapterCapabilityProbation:{writeSafe:true}},productionControls:{operatingProfile:'balanced'}};
  const preview=buildPolicyImpactPreview(snapshot,{kind:'operating_profile',profile:'fast'},1000);
  const command=normalizeDashboardCommand({sessionId:'s',requestId:'r2',command:'apply_operating_profile',payload:{profile:'fast',preview,secret:'remove'}});
  assert.deepEqual(Object.keys(command.payload).sort(),['preview','profile']);
});

test('Bug cycle 4: duplicate dashboard operations share one in-flight promise', () => {
  const dashboard=source('../dashboard/dashboard.js');
  assert.match(dashboard,/operationKey/);
  assert.match(dashboard,/duplicate\?\.promise/);
  assert.match(dashboard,/timeoutId, promise, operationKey/);
});

test('Bug cycle 5: ambiguous no-response and draft-conflict decisions route to Assist without commands', () => {
  const noResponse=deriveOperatorChoice({batchState:{pendingNoResponse:{batchId:'b',createdAt:1},next:{batchId:'n',memberFingerprint:'f'}}},100);
  assert.equal(noResponse.view,'assist'); assert.equal(noResponse.anchor,'choiceWorkspace'); assert.equal('command' in noResponse,false);
  const conflict=deriveOperatorChoice({batchState:{draftConflict:{batchId:'b',state:'unresolved',manualFingerprint:'m',pmiaFingerprint:'p',createdAt:1},next:{memberFingerprint:'n'}}},100);
  assert.equal(routeForDecision(conflict).view,'assist');
});

test('Bug cycle 6: Action Dock counts unresolved once and disconnects stale executable actions', () => {
  const dock=deriveLiveActionDock({dashboardConnections:0,ledgerCounts:{unresolved:3,pending:3,inFlight:2},production:{decisionCenter:{primary:{title:'Run',detail:'x',command:'pause'}}}});
  assert.equal(dock.waiting,3); assert.equal(dock.action.mode,'inspect'); assert.equal(dock.connected,false);
});

test('Bug cycle 7: expired runtime leases permit takeover without generation regression', () => {
  const current={instanceId:'old',documentId:'d1',generation:2,createdAt:0,heartbeatAt:0,expiresAt:100};
  const takeover=claimRuntimeInjection(current,{instanceId:'new',documentId:'d2',generation:2,createdAt:200},1200,{leaseMs:100});
  assert.equal(takeover.accepted,true); assert.equal(takeover.reason,'runtime_lease_takeover');
  assert.equal(claimRuntimeInjection(current,{instanceId:'bad',documentId:'d3',generation:1},1200,{leaseMs:100}).accepted,false);
});

test('Bug cycle 8: prerendered, frozen, discarded, and inactive hidden pages cannot own provider writes', () => {
  for(const state of [{prerendering:true},{pageFrozen:true},{discarded:true},{visibilityState:'hidden',activeTab:false}]) assert.equal(derivePrerenderGuard(state).allowProviderWrite,false);
});

test('Bug cycle 9: runtime release requires exact instance, document, and generation ownership', () => {
  const owner={instanceId:'i',documentId:'d',generation:3};
  assert.equal(releaseRuntimeInjection(owner,{instanceId:'i',documentId:'d',generation:2}).released,false);
  assert.equal(releaseRuntimeInjection(owner,{instanceId:'i',documentId:'d',generation:3}).released,true);
});

test('Bug cycle 10: nested dialogs preserve stack order and return focus safely', () => {
  const trigger=fakeNode('trigger'),childTrigger=fakeNode('child');
  const buttonA=fakeNode('a'),buttonB=fakeNode('b');
  const dialogA={hidden:true,querySelectorAll:()=>[buttonA],focus(){}};
  const dialogB={hidden:true,querySelectorAll:()=>[buttonB],focus(){}};
  const coordinator=createDialogFocusCoordinator({activeElement:()=>buttonB});
  assert.equal(coordinator.open(dialogA,trigger),true); assert.equal(coordinator.open(dialogB,childTrigger),true); assert.equal(coordinator.depth(),2);
  coordinator.close(dialogB); assert.equal(coordinator.depth(),1); coordinator.close(dialogA); assert.equal(trigger.focused,true);
});

test('Bug cycle 11: alarm rehydration deduplicates schedules and preserves overdue evidence', async () => {
  const created=[],cleared=[];
  const result=await auditAndRehydrateAlarms({now:1000,schedules:[{alarmName:'pmia-recovery:s',dueAt:500,generation:1},{alarmName:'pmia-recovery:s',dueAt:600,generation:2}],existingAlarms:[{name:'pmia-recovery:orphan',scheduledTime:900}],create:async(name,info)=>created.push({name,info}),clear:async name=>cleared.push(name)});
  assert.equal(result.expected,1); assert.equal(result.overdue.length,1); assert.equal(created.length,1); assert.deepEqual(cleared,['pmia-recovery:orphan']);
});

test('Bug cycle 12: cleanup transaction rejects out-of-order steps and requires explicit retry', () => {
  let tx=beginCleanupTransaction({sessionId:'s',now:1,id:'c'});
  assert.equal(recordCleanupStep(tx,'clear_registry',{ok:true},2).error,'cleanup_step_out_of_order');
  tx=recordCleanupStep(tx,'freeze_commands',{ok:false,error:'busy'},2).transaction;
  assert.equal(recordCleanupStep(tx,'freeze_commands',{ok:true},3).error,'cleanup_retry_required');
  tx=recordCleanupStep(tx,'freeze_commands',{ok:true,retry:true},3).transaction;
  assert.equal(resumeCleanupTransaction(tx).nextStep,'export_optional');
});

test('Bug cycle 13: sender outbox persists failed attempt metadata and clears only on persisted acknowledgement', async () => {
  const store=memoryStorage(); const outbox=createSenderOutbox({storage:store,key:'outbox',now:()=>1000,random:()=>0});
  await outbox.enqueue(envelope('q1',1)); await outbox.replay(async()=>({ok:false,persisted:false,error:'offline'}));
  assert.equal(outbox.snapshot().attempts,1); assert.equal(outbox.size,1);
  const restored=createSenderOutbox({storage:store,key:'outbox'}); assert.equal(restored.snapshot().attempts,1);
  await restored.replay(async()=>({ok:true,persisted:true})); assert.equal(restored.size,0);
});

test('Bug cycle 14: ledger index repairs duplicate IDs and provider sequences deterministically', () => {
  const index=new DeliveryLedgerIndex();
  const entries=[{...envelope('a',1),envelope:envelope('a',1),state:'persisted'},{...envelope('a',2),envelope:envelope('a',2),state:'persisted'},{...envelope('c',1),envelope:envelope('c',1),state:'persisted'}];
  const result=index.repair(entries);
  assert.equal(result.kept.length,1); assert.deepEqual(result.rejected.map(item=>item.reason).sort(),['duplicate_id','duplicate_sequence']);
});

test('Bug cycle 15: sequence buffer returns exact ACK, duplicate ACK, gap NACK, and reject semantics', () => {
  const buffer=new ContiguousSequenceBuffer(); buffer.offer(envelope('q1',1)); buffer.offer(envelope('q3',3));
  assert.equal(buffer.confirmDetailed(1).reason,'sequence_confirmed'); assert.equal(buffer.confirmDetailed(1).reason,'duplicate_ack');
  assert.equal(buffer.confirmDetailed(3).reason,'sequence_gap'); assert.equal(buffer.reject(3).ok,true);
});

test('Bug cycle 16: receiver credit never exceeds capacity and stabilizes after backpressure', () => {
  const credits=new ReceiverCreditHysteresis({recoveryWindowMs:100});
  assert.equal(credits.update({available:0,capacity:2},{now:0}).canAccept,false);
  assert.equal(credits.update({available:99,capacity:2},{now:50}).available,0);
  const stable=credits.update({available:99,capacity:2},{now:151}); assert.equal(stable.available,2); assert.equal(stable.canAccept,true);
});

test('Bug cycle 17: fair scheduler promotes a starved partition before newer sources', () => {
  const selected=scheduleFairBatch([{id:'new',source:'a',oldestAt:990,firstSeq:2},{id:'old',source:'b',oldestAt:100,firstSeq:1}],{now:1200,starvationMs:1000});
  assert.equal(selected.selected.id,'old'); assert.equal(selected.reason,'starvation_promoted');
});

test('Bug cycle 18: composer merge is idempotent when the manual prefix already contains the protected draft', () => {
  const provider=adapter(); const arbiter=createComposerArbiter({adapter:provider});
  arbiter.writeBatch('Protected'); provider.text='Manual\n\n---\n\nProtected'; arbiter.observe();
  const result=arbiter.resolveConflict('merge'); assert.equal(result.ok,true); assert.equal(provider.text.match(/Protected/g)?.length,1); assert.equal(provider.text,'Manual --- Protected');
});

test('Bug cycle 19: provider route readiness blocks missing live roles, composer, self-test, and unsafe writes', () => {
  const result=deriveProviderRouteReadiness({sender:{provider:'chatgpt',connected:false,adapterCapabilities:{complete:true}},receiver:{provider:'chatgpt',connected:true,composerReady:false,adapterCapabilities:{complete:true},adapterCapabilityProbation:{writeSafe:false}},contextArmed:true,selfTest:{ok:false}});
  for(const code of ['sender_runtime_missing','receiver_composer_not_ready','receiver_write_unsafe','self_test_not_ready']) assert.equal(result.blockers.includes(code),true);
});

test('Bug cycle 20: provider route changes freeze writes while protected ownership exists', () => {
  const transition=deriveProviderRouteTransition({sender:{provider:'chatgpt'},receiver:{provider:'chatgpt'},ledgerCounts:{unresolved:2}},{receiver:'claude'});
  assert.equal(transition.state,'freeze_required'); assert.equal(transition.allowProviderWrite,false); assert.equal(transition.protectedCount,2);
});

test('Bug cycle 21: UTF-8 accounting handles unmatched surrogates and compaction protects actionable bytes', () => {
  assert.equal(utf8Bytes('\ud800'),3); assert.equal(utf8Bytes('😀'),4);
  const plan=buildCompactionPlan({total:1000,telemetry:300,snapshots:300,proven:300,actionable:100},100);
  assert.equal(plan.actionableProtected,true); assert.equal(plan.remainingBytes,0); assert.deepEqual(plan.plan.map(item=>item.category),['telemetry','snapshots','proven']);
});

test('Bug cycle 22: snapshot deltas remove absent sections and reconstruct the exact semantic snapshot', () => {
  const previous={a:{x:1},b:2,now:1},next={a:{x:2},c:3,now:999};
  const delta=buildSnapshotDelta(previous,next); const applied=applySnapshotDelta(previous,delta);
  assert.deepEqual(delta.removed,['b']); assert.deepEqual(applied,{a:{x:2},c:3,now:1});
});

test('Bug cycle 23: virtual windows clamp beyond the list and cancelled render frames cannot fire stale work', () => {
  assert.deepEqual(deriveVirtualList({count:5,scrollTop:9999,viewportHeight:100,rowHeight:20,overscan:1}),{start:5,end:5,count:0,top:100,bottom:0,totalHeight:100});
  let callback=null,cancelled=0,renders=0; const scheduler=createRenderScheduler({frame:fn=>{callback=fn;return 1;},cancelFrame:()=>{cancelled+=1;}});
  scheduler.schedule(['queue'],()=>{renders+=1;}); scheduler.cancel(); callback(); assert.equal(cancelled,1); assert.equal(renders,0);
});

test('Bug cycle 24: low-evidence forecasts do not invent catch-up estimates or double-count ownership', () => {
  const backlog=deriveBacklogForecast({queued:3,oldestAgeMs:1000,targetMs:20000,proofs:[],proofLatenciesMs:[]},10000);
  assert.equal(backlog.confidence,'low'); assert.equal(backlog.drainEstimateMs,null); assert.equal(backlog.risk,'unknown');
  const live=deriveLivePerformanceForecast({ledgerCounts:{unresolved:2,pending:2,inFlight:2},timeline:[],metrics:{}},10000);
  assert.equal(live.unresolved,2); assert.equal(live.state,'insufficient_evidence');
});

test('Bug cycle 25: monotonic clocks reject stale worker generations without moving elapsed time backward', () => {
  const current={wallAnchor:100,monoAnchor:10,elapsedBeforeAnchor:500,generation:4};
  const stale=reanchorMonotonicClock(current,{wallNow:200,monoNow:20,generation:3});
  assert.equal(stale.generation,4); assert.equal(stale.staleGeneration,true); assert.equal(stale.elapsedBeforeAnchor,500);
});

test('Bug cycle 26: accessibility audit catches broken references and preferences fail safely without a root', () => {
  const ids=[fakeNode('label'),fakeNode('dialog')]; const control=fakeNode('button',{'aria-labelledby':'missing','aria-controls':'missing-panel'}); const dialog=fakeNode('dialog',{'aria-labelledby':'missing-dialog'}); const live=[fakeNode('',{'aria-live':'polite'})];
  const documentLike={querySelectorAll(selector){ if(selector==='[id]')return ids;if(selector==='button,input,select,textarea,[role="button"]')return [control];if(selector==='[role="dialog"],dialog')return [dialog];if(selector==='[aria-controls]')return [control];if(selector==='[aria-live]')return live;return []; }};
  const audit=auditDashboardAccessibility(documentLike);
  for(const code of ['label_target_missing','dialog_label_target_missing','control_target_missing','assertive_live_region_missing']) assert.equal(audit.issues.some(item=>item.code===code),true);
  const applied=applyAccessibilityPreferences(null,{reducedMotion:'system'},()=>{throw new Error('media');}); assert.equal(applied.applied,false);
});

test('Bug cycle 27: support bundles remove content-like keys and redact URL or credential values', () => {
  const bundle=buildSafeSupportBundle({sessionId:'s',performanceBudget:{questionText:'secret',nested:{value:'https://private.example',token:'abc'}},ledger:[{id:'q1',state:'proven',envelope:{seq:1,metadata:{traceId:'t'}}}]},{manifest:{name:'PMIA',version:'0.10.0'}});
  const text=JSON.stringify(bundle); assert.equal(text.includes('secret'),false); assert.equal(text.includes('private.example'),false); assert.equal(text.includes('"token"'),false); assert.equal(auditSafeSupportBundle(bundle).safe,true);
});

test('Bug cycle 28: isolated browser gate requires explicit Choice Workspace and Assist responsive evidence', () => {
  const smoke=source('../../scripts/isolated-release-smoke.mjs');
  assert.match(smoke,/data-choice-option="continue"/); assert.match(smoke,/assistUiState/); assert.match(smoke,/assistUiOk/); assert.match(smoke,/sourceCommit/);
});

test('Bug cycle 29: deterministic release evidence requires commit-bound Assist, Pilot, Production, drill, and cleanup proof', () => {
  const builder=source('../../scripts/build-release-evidence-manifest.mjs');
  assert.match(builder,/Smoke evidence is not bound to a source commit/); assert.match(builder,/assistUiOk/); assert.match(builder,/productionUiOk/); assert.match(builder,/transportDrillOk/); assert.match(builder,/profileRemoved/);
});

test('Bug cycle 30: handoff fails closed without exact source, commit, Assist, browser, privacy, cleanup, and no-push evidence', () => {
  const snapshot={ledgerCounts:{unresolved:0}}; const production={diagnostics:{state:'healthy',score:100,privacy:{safe:true},fingerprint:{version:'0.10.0',commit:'abc'}},routeReadiness:{route:'chatgpt -> chatgpt'},operatingProfile:{id:'balanced'}};
  const incomplete=deriveReleaseHandoff(snapshot,production,{commit:'abc',expectedCommit:'abc',sourceClean:true,automatedOk:true,browserOk:true,cleanupOk:true,noPushMergeTag:true});
  assert.equal(incomplete.ready,false); assert.equal(incomplete.failed.includes('assist'),true);
  const evidence={commit:'abc',expectedCommit:'abc',sourceClean:true,automatedOk:true,browserOk:true,assistUiOk:true,cleanupOk:true,noPushMergeTag:true,generatedAt:1};
  const complete=deriveReleaseHandoff(snapshot,production,evidence); assert.equal(complete.ready,true);
  assert.equal(buildHandoffManifest({snapshot,production,evidence}).version,'0.10.0');
});
