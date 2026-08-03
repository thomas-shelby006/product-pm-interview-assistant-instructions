import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateRuntimeEnvelope } from '../shared/runtime-state-migrations.js';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';
import { createSessionNavigatorCache, navigatorDeltaAffectsSemantics } from '../dashboard/session-navigator-cache.js';

function staleNavigatorState() {
  return [{
    sessionId:'s1',
    ledger:[{ id:'q1', seq:1, kind:'question', state:'persisted', text:'Q1' }],
    sessionNavigator:{
      history:[{ id:'h1', tab:'unknown', visitedAt:1 }],
      bookmarks:[{ id:'b1', targetType:'question', targetId:'missing', label:'stale' }],
      goals:[{ id:'g1', label:'Discovery', targetCount:1 }],
      coverage:{ missing:['g1'] }, activeWorkspaceId:'missing'
    }
  }];
}

test('Cycles 201-205: schema three migrates deterministically to Navigator-aware schema four', () => {
  const result=migrateRuntimeEnvelope({schemaVersion:3,writerVersion:'0.10.0',sessions:[{sessionId:'s1'}]},4,{writerVersion:'0.11.0',now:20});
  assert.equal(result.ok,true);assert.deepEqual(result.applied,['3->4']);
  assert.equal(result.envelope.sessions[0].sessionNavigator.defaultTab,'now');
});
test('Cycles 206-208: stale Navigator metadata repairs without changing delivery ownership', () => {
  const pilot=new RuntimePilotState(staleNavigatorState());
  const before=pilot.snapshot('s1',100);
  const result=pilot.repairSessionNavigatorMetadata('s1',110);
  const after=pilot.snapshot('s1',120);
  assert.equal(result.ok,true);assert.equal(result.changed,true);
  assert.deepEqual(after.ledger.map(item=>[item.id,item.state]),before.ledger.map(item=>[item.id,item.state]));
  assert.deepEqual(after.sessionNavigator.bookmarks,[]);
  assert.deepEqual(after.sessionNavigator.coverage,{});
  assert.equal(after.sessionNavigator.activeWorkspaceId,'');
});

test('Cycles 209-210: semantic cache ignores heartbeats but invalidates relevant deltas', () => {
  let builds=0;
  const cache=createSessionNavigatorCache((snapshot,local,now,options={})=>{
    builds+=1;return { phase:snapshot.liveSession?.phase||'setup', query:local.query||'', base:options.base?._cache||null, _cache:{ledgerCount:snapshot.ledger?.length||0} };
  });
  const snapshot={sessionId:'s1',ledger:[{id:'q1'}],liveSession:{phase:'active'}};
  cache.get(snapshot,{query:''},100,1);
  cache.get({...snapshot,sender:{heartbeatAt:200}},{query:'q'},200,1);
  assert.equal(cache.stats().misses,1);
  assert.equal(navigatorDeltaAffectsSemantics(['sender']),false);
  assert.equal(navigatorDeltaAffectsSemantics(['ledger']),true);
  cache.get({...snapshot,ledger:[{id:'q1'},{id:'q2'}]},{},300,2);
  assert.equal(cache.stats().misses,2);
  assert.ok(builds>=4,'dynamic model still recomputes from the latest snapshot');
});
