import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';
import { normalizeSessionNavigator, recordNavigatorHistory } from '../shared/session-navigator-state.js';
import { deriveNavigatorBreadcrumbs, deriveNavigatorPrimaryAction, deriveSessionNavigatorNow } from '../dashboard/session-navigator-now-model.js';
import { createSessionNavigatorLocalState, navigatorQuickOpenFromKeyboard, navigatorTabFromKey } from '../dashboard/session-navigator-controller.js';

function snapshot(value = {}) {
  return {
    mode:'active', liveSession:{ phase:'active' }, sender:{ connected:true }, receiver:{ connected:true },
    ledger:[], ledgerCounts:{ unresolved:0 }, batchState:{ active:null, next:null }, answerState:{ state:'idle' },
    deliveryPolicy:{ active:false }, consistencyAudit:{ ok:true }, ...value
  };
}

test('Cycle 151 normalizes bounded content-free navigator metadata', () => {
  const value = normalizeSessionNavigator({ history:Array.from({length:80},(_,i)=>({id:`h${i}`,tab:'now',at:i+1})), bookmarks:[{id:'b1',targetType:'trace',targetId:'t1',label:'Evidence'}], goals:[{id:'g1',label:'Metrics',targetCount:2}] });
  assert.equal(value.version,1);
  assert.equal(value.history.length,48);
  assert.deepEqual(value.bookmarks[0],{id:'b1',targetType:'trace',targetId:'t1',category:'evidence',label:'Evidence',createdAt:0,reviewedAt:0});
  assert.equal(JSON.stringify(value).includes('answer text'),false);
});

test('Cycle 151 persists navigator metadata through Pilot export and restore', () => {
  const state = new RuntimePilotState([{sessionId:'s1',createdAt:1,sessionNavigator:{defaultTab:'threads',history:[{id:'h1',tab:'threads',at:10}]}}]);
  state.recordSessionNavigatorVisit('s1',{id:'h2',tab:'now',reason:'test'},20);
  const restored = new RuntimePilotState(state.exportState());
  const result = restored.snapshot('s1',30).sessionNavigator;
  assert.equal(result.defaultTab,'threads');
  assert.deepEqual(result.history.map(item=>item.id),['h1','h2']);
});

test('Cycles 152-153 derive current-state rail and workflow breadcrumbs', () => {
  const value = deriveSessionNavigatorNow(snapshot({liveSession:{phase:'debrief'},postInterview:{exportComplete:true,reviewReady:true}}),{},100);
  assert.equal(value.phase,'review');
  assert.equal(value.rail.length,4);
  assert.equal(value.breadcrumbs.find(item=>item.id==='review').state,'current');
  assert.equal(value.breadcrumbs.find(item=>item.id==='shutdown').state,'upcoming');
});

test('Cycle 154 chooses required operator choices before generic next actions', () => {
  const noResponse = deriveNavigatorPrimaryAction(snapshot({batchState:{pendingNoResponse:{batchId:'b1'}}}),100);
  assert.equal(noResponse.id,'choose_no_response');
  assert.equal(noResponse.view,'queue');
  const conflict = deriveNavigatorPrimaryAction(snapshot({batchState:{draftConflict:{state:'unresolved'}}}),100);
  assert.equal(conflict.id,'resolve_draft');
});

test('Cycle 155 keyboard quick-open and roving tabs are deterministic', () => {
  const local = createSessionNavigatorLocalState();
  const opened = navigatorQuickOpenFromKeyboard({key:'N',ctrlKey:true,shiftKey:true},local);
  assert.equal(opened.open,true);
  assert.equal(opened.activeTab,'now');
  const next = navigatorTabFromKey({key:'ArrowRight'},opened);
  assert.equal(next.activeTab,'search');
  const last = navigatorTabFromKey({key:'End'},next);
  assert.equal(last.activeTab,'debrief');
});

test('Cycles 151-155 package one Navigator surface and allow-listed visit command', async () => {
  const [html,script,css,protocol,registry] = await Promise.all([
    readFile(new URL('../dashboard/index.html',import.meta.url),'utf8'),
    readFile(new URL('../dashboard/dashboard.js',import.meta.url),'utf8'),
    readFile(new URL('../dashboard/dashboard.css',import.meta.url),'utf8'),
    readFile(new URL('../shared/dashboard-protocol.js',import.meta.url),'utf8'),
    readFile(new URL('../shared/operator-command-registry.js',import.meta.url),'utf8')
  ]);
  assert.match(html,/data-view="navigator"[\s\S]*id="panelNavigator"/);
  assert.match(html,/id="sessionNavigatorBreadcrumbs"[\s\S]*data-navigator-tab="debrief"/);
  assert.match(script,/deriveSessionNavigatorNow[\s\S]*renderSessionNavigator/);
  assert.match(script,/navigatorQuickOpenFromKeyboard/);
  assert.match(css,/session-navigator-rail/);
  assert.match(protocol,/record_session_navigator_visit/);
  assert.match(registry,/record_session_navigator_visit/);
});
