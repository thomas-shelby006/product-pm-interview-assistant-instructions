const VIEWS=Object.freeze(['flow','transport','proof','recovery','closure','signals','forecast','plans','evidence','review']);
const SCENARIOS=Object.freeze(['current','service_worker_restart','receiver_reload','provider_drift','network_loss']);
export function normalizeOperationsLabView(value){const id=String(value||'').trim();return VIEWS.includes(id)?id:'flow';}
export function normalizeOperationsLabScenario(value){const id=String(value||'').trim();return SCENARIOS.includes(id)?id:'current';}
export function createOperationsLabLocalState(value={}){return{sessionId:String(value.sessionId||''),view:normalizeOperationsLabView(value.view),scenario:normalizeOperationsLabScenario(value.scenario)};}
export function reconcileOperationsLabLocalState(state={},sessionId=''){const next=String(sessionId||'');return String(state.sessionId||'')===next?createOperationsLabLocalState(state):createOperationsLabLocalState({sessionId:next});}
export function selectOperationsLabView(state={},view){return{...createOperationsLabLocalState(state),view:normalizeOperationsLabView(view)};}
export function selectOperationsLabScenario(state={},scenario){return{...createOperationsLabLocalState(state),scenario:normalizeOperationsLabScenario(scenario)};}
export function moveOperationsLabTab(current,key){const view=normalizeOperationsLabView(current),index=VIEWS.indexOf(view);if(key==='Home')return VIEWS[0];if(key==='End')return VIEWS.at(-1);if(key==='ArrowLeft')return VIEWS[(index-1+VIEWS.length)%VIEWS.length];if(key==='ArrowRight')return VIEWS[(index+1)%VIEWS.length];return view;}
export const operationsLabViews=()=>[...VIEWS];
export const operationsLabScenarios=()=>[...SCENARIOS];
