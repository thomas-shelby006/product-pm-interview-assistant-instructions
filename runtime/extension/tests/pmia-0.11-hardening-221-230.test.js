import test from 'node:test';
import assert from 'node:assert/strict';
import { compactNavigatorMetadata, deriveNavigatorBudget } from '../shared/session-navigator-budget.js';
import { deriveSessionNavigator } from '../dashboard/session-navigator-model.js';

function oversizedNavigator() {
  return {
    history:Array.from({length:48},(_,i)=>({id:`h${i}`,tab:'search',at:i+1})),
    bookmarks:Array.from({length:96},(_,i)=>({id:`b${i}`,targetType:'session',targetId:'s1',label:`Evidence ${i}`})),
    goals:[{id:'g1',label:'Discovery',targetCount:2}],
    coverage:{q1:['g1','missing'],missing:['g1']},workspaces:[],scenarioCompletion:[]
  };
}

test('Cycles 221-225: Navigator compaction is bounded and preserves valid goal coverage', () => {
  const value=oversizedNavigator();
  const before=deriveNavigatorBudget(value);
  const result=compactNavigatorMetadata(value,{keepHistory:12,keepBookmarks:20});
  const after=deriveNavigatorBudget(result.value);
  assert.equal(result.value.history.length,12);assert.equal(result.value.bookmarks.length,20);
  assert.deepEqual(result.value.coverage.q1,['g1']);
  assert.ok(after.bytes<before.bytes);
});
test('Cycles 226-230: post-interview Review requires verified two-role export', () => {
  const base={
    sessionId:'s1',liveSession:{phase:'debrief'},ledger:[],ledgerCounts:{unresolved:0},
    sessionNavigator:{goals:[],coverage:{},history:[],bookmarks:[],workspaces:[],scenarioCompletion:[]},
    commandJournal:[]
  };
  const before=deriveSessionNavigator(base,{},100);
  assert.equal(before.postInterview.exportComplete,false);
  assert.equal(before.postInterview.reviewReady,false);
  const after=deriveSessionNavigator({...base,commandJournal:[{command:'export_session',result:{ok:true,exportedTabIds:[11,22]}}]}, {}, 110);
  assert.equal(after.postInterview.exportComplete,true);
  assert.equal(after.postInterview.reviewReady,after.debrief.exportReady);
});

test('Cycles 226-230: failed or partial export cannot unlock Review', () => {
  const common={sessionId:'s1',liveSession:{phase:'debrief'},ledger:[],sessionNavigator:{goals:[],coverage:{}}};
  for(const result of [{ok:false,exportedTabIds:[11,22]},{ok:true,exportedTabIds:[11]}]){
    const model=deriveSessionNavigator({...common,commandJournal:[{command:'export_session',result}]},{},100);
    assert.equal(model.postInterview.exportComplete,false);
  }
});
