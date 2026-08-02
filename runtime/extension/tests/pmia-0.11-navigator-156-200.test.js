import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';
import { buildSessionSearchIndex, searchSessionEntities, buildSearchPreview, validateNavigatorJumpIntent, recentNavigatorHistory } from '../dashboard/session-navigator-search-model.js';
import { buildQuestionThreadGraph, questionFollowUpChain, deriveThreadCompletion, validateQuestionRelationship } from '../dashboard/session-navigator-thread-model.js';
import { derivePaceBaseline, segmentTimeRemaining, silenceDeviation, derivePaceGuidance } from '../dashboard/session-navigator-pace-model.js';
import { deriveHandoffBoard } from '../dashboard/session-navigator-handoff-model.js';
import { listNavigatorWorkspaces, previewWorkspaceImpact, validateWorkspaceApply } from '../dashboard/session-navigator-workspace-model.js';
import { compareScenarioWithCurrent } from '../dashboard/session-navigator-scenario-model.js';
import { validateBookmarkTarget, deriveBookmarkNavigator } from '../dashboard/session-navigator-bookmark-model.js';
import { validateCompetencyTarget, validateCoverageTag, deriveGoalCoverageMatrix } from '../dashboard/session-navigator-goal-model.js';
import { deriveGuidedDebrief, buildMetadataDebriefExport } from '../dashboard/session-navigator-debrief-model.js';

function snapshot(value = {}) {
  return {sessionId:'s1',updatedAt:10,mode:'active',liveSession:{phase:'active',startedAt:1,lastInterviewerActivityAt:1,history:[]},ledger:[{id:'q1',seq:1,state:'proven',text:'How do you measure activation?',persistedAt:1},{id:'q2',seq:2,state:'persisted',text:'What would you prioritize?',persistedAt:2}],ledgerCounts:{unresolved:1},questionOperations:{metadata:{q2:{parentId:'q1',priority:'high'}}},operatorMarkers:[{id:'m1',category:'needs_review',targetType:'envelope',targetId:'q1',createdAt:5}],timeline:[{id:'e1',type:'batch_proven',at:5,data:{batchId:'b1'}}],metrics:{answerElapsedMs:[60000,90000],answersCompleted:2,finalsObserved:2,deliverySuccessRate:100,answerAvailabilityRate:100},batchState:{active:null,next:{id:'b2',questionCount:1},answerAcknowledgement:null},answerState:{state:'complete'},deliveryPolicy:{active:false},consistencyAudit:{ok:true},senderOutboxState:{count:0},sessionNavigator:{bookmarks:[],goals:[],coverage:{},workspaces:[],scenarioCompletion:[]},...value};
}

test('Cycles 156-160 universal search indexes session entities, ranks and validates jumps', () => {
  const index=buildSessionSearchIndex(snapshot());assert.ok(index.some(item=>item.type==='question'&&item.id==='q1'));assert.ok(index.some(item=>item.type==='marker'));
  const results=searchSessionEntities(index,'activation',10);assert.equal(results[0].id,'q1');
  assert.equal(validateNavigatorJumpIntent(buildSearchPreview(results[0]).jump,snapshot()).ok,true);
  assert.equal(validateNavigatorJumpIntent({view:'queue',anchor:'queueList',entityType:'question',entityId:'missing'},snapshot()).error,'navigator_target_stale');
  assert.equal(recentNavigatorHistory([{id:'a',tab:'now',at:1}],[{id:'b',tab:'search',entityType:'question',entityId:'q1',at:2}])[0].id,'b');
});

test('Cycles 161-165 thread graph preserves order, completion and cycle safety', () => {
  const graph=buildQuestionThreadGraph(snapshot());assert.deepEqual(graph.roots,['q1']);assert.deepEqual(questionFollowUpChain(graph,'q2').map(item=>item.id),['q1','q2']);
  assert.equal(deriveThreadCompletion(graph,'q1').complete,false);
  assert.equal(validateQuestionRelationship(snapshot(),'q1','q2').error,'relationship_cycle');
  assert.equal(validateQuestionRelationship(snapshot(),'q2','q1').ok,true);
});

test('Cycles 166-170 pace models use observed baselines and distinguish silence', () => {
  const value=snapshot({liveSession:{phase:'active',startedAt:1,lastInterviewerActivityAt:1000,segment:{id:'case',label:'Case',startedAt:1000,durationMs:120000}}});
  assert.equal(derivePaceBaseline(value).baselineMs,75000);
  assert.equal(segmentTimeRemaining(value,61000).remainingMs,60000);
  assert.equal(silenceDeviation(value,derivePaceBaseline(value),200000).state,'long');
  assert.ok(derivePaceGuidance(value,200000).label);
});

test('Cycles 171-175 handoff blocks unsafe advance and exposes one action', () => {
  const blocked=deriveHandoffBoard(snapshot({batchState:{active:{id:'b1',questionCount:1},next:{id:'b2',questionCount:1},pendingNoResponse:{batchId:'b1'}},answerState:{state:'no_response'}}));
  assert.equal(blocked.ready,false);assert.ok(blocked.blockers.some(item=>item.code==='no_response_choice_required'));
  const ready=deriveHandoffBoard(snapshot());assert.equal(ready.ready,true);assert.equal(ready.action.command,'submit_now');
});

test('Cycles 176-180 workspace impact is explicit and metadata-only', () => {
  const value=snapshot();const workspace=listNavigatorWorkspaces(value).find(item=>item.id==='live_focus');const preview=previewWorkspaceImpact(value,workspace);assert.equal(preview.providerWrites,false);assert.equal(preview.reversible,true);assert.equal(validateWorkspaceApply(preview,workspace).ok,true);
});

test('Cycles 181-185 scenario coach compares expected checks without mutating state', () => {
  const before=JSON.stringify(snapshot());const result=compareScenarioWithCurrent(snapshot(),'normal_q1_q2_q3');assert.equal(result.ok,true);assert.equal(result.total,4);assert.equal(JSON.stringify(snapshot()),before);
});

test('Cycles 186-190 bookmark targets must still exist', () => {
  assert.equal(validateBookmarkTarget(snapshot(),{targetType:'question',targetId:'q1',label:'Activation'}).ok,true);
  assert.equal(validateBookmarkTarget(snapshot(),{targetType:'question',targetId:'missing'}).error,'bookmark_target_missing');
  const value=snapshot({sessionNavigator:{bookmarks:[{id:'b1',targetType:'question',targetId:'q1',category:'review',label:'Review',createdAt:1}],goals:[],coverage:{},workspaces:[],scenarioCompletion:[]}});assert.equal(deriveBookmarkNavigator(value).invalid,0);
});

test('Cycles 191-195 goals validate targets and coverage against real questions', () => {
  const goal=validateCompetencyTarget({id:'metrics',label:'Metrics',targetCount:2,priority:'high'});assert.equal(goal.ok,true);
  const value=snapshot({sessionNavigator:{bookmarks:[],goals:[goal.goal],coverage:{q1:['metrics']},workspaces:[],scenarioCompletion:[]}});assert.equal(validateCoverageTag(value,'q1',['metrics']).ok,true);assert.equal(validateCoverageTag(value,'missing',['metrics']).error,'coverage_question_missing');assert.equal(deriveGoalCoverageMatrix(value).goals[0].percent,50);
});

test('Cycles 196-200 debrief export is metadata-only and blocks unresolved decisions', () => {
  const blocked=deriveGuidedDebrief(snapshot());assert.equal(blocked.exportReady,false);
  const clean=snapshot({ledger:[{id:'q1',seq:1,state:'proven'}],ledgerCounts:{unresolved:0},sessionNavigator:{bookmarks:[],goals:[],coverage:{},workspaces:[],scenarioCompletion:[]}});const output=buildMetadataDebriefExport(clean,99);assert.equal(output.privacy.containsQuestionText,false);assert.equal(output.privacy.containsAnswerText,false);assert.equal(JSON.stringify(output).includes('How do you measure activation'),false);
});

test('Cycles 176-200 persist workspaces, bookmarks, goals, coverage, scenarios and debrief count', () => {
  const state=new RuntimePilotState([{sessionId:'s1',createdAt:1,ledger:[{id:'q1',seq:1,state:'proven'}]}]);
  state.upsertSessionNavigatorWorkspace('s1',{id:'w1',label:'Live',visiblePanels:['rail'],focus:'now'},10);
  state.upsertSessionNavigatorBookmark('s1',{id:'b1',targetType:'question',targetId:'q1',label:'Evidence'},11);
  state.upsertSessionNavigatorGoal('s1',{id:'g1',label:'Metrics',targetCount:1},12);
  state.tagSessionNavigatorCoverage('s1','q1',['g1'],13);
  state.markSessionNavigatorScenarioComplete('s1','restart',14);
  state.recordSessionNavigatorDebriefExport('s1',15);
  const restored=new RuntimePilotState(state.exportState()).snapshot('s1',20).sessionNavigator;
  assert.equal(restored.activeWorkspaceId,'w1');assert.equal(restored.bookmarks[0].id,'b1');assert.equal(restored.goals[0].id,'g1');assert.deepEqual(restored.coverage.q1,['g1']);assert.ok(restored.scenarioCompletion.includes('restart'));assert.equal(restored.debriefExports,1);
});

test('Cycles 156-200 package all Navigator panels and safe metadata commands', async () => {
  const [html,script,renderer,protocol,registry] = await Promise.all([
    readFile(new URL('../dashboard/index.html',import.meta.url),'utf8'),readFile(new URL('../dashboard/dashboard.js',import.meta.url),'utf8'),readFile(new URL('../dashboard/render-session-navigator.js',import.meta.url),'utf8'),readFile(new URL('../shared/dashboard-protocol.js',import.meta.url),'utf8'),readFile(new URL('../shared/operator-command-registry.js',import.meta.url),'utf8')]);
  for(const id of ['search','threads','pace','handoff','workspaces','scenarios','bookmarks','goals','debrief']) assert.match(html,new RegExp(`data-navigator-panel="${id}"`));
  assert.match(script,/validateNavigatorJumpIntent[\s\S]*validateQuestionRelationship[\s\S]*buildMetadataDebriefExport/);
  assert.match(renderer,/renderSearch[\s\S]*renderThreads[\s\S]*renderDebrief/);
  for(const command of ['save_navigator_workspace','add_navigator_bookmark','set_navigator_goal','tag_navigator_coverage','mark_navigator_scenario_complete','record_navigator_debrief_export']) { assert.match(protocol,new RegExp(command));assert.match(registry,new RegExp(command)); }
});
