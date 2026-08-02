const PANELS=new Set(['rail','breadcrumbs','decision','queue','threads','pace','handoff','incidents','recovery','scorecard','production']);
const FOCUS=new Set(['now','delivery','answer','recovery','review','production']);

export const DEFAULT_NAVIGATOR_WORKSPACES=Object.freeze([
  {id:'live_focus',label:'Live Focus',visiblePanels:['rail','decision','queue','handoff'],filters:{queue:'actionable'},focus:'now'},
  {id:'recovery',label:'Recovery',visiblePanels:['rail','incidents','recovery','production'],filters:{severity:'actionable'},focus:'recovery'},
  {id:'debrief',label:'Debrief',visiblePanels:['threads','pace','scorecard','production'],filters:{review:'all'},focus:'review'}
]);

function safeWorkspace(value={}){return{id:String(value.id||'').slice(0,120),label:String(value.label||'').slice(0,160),visiblePanels:[...new Set((value.visiblePanels||[]).map(String).filter(item=>PANELS.has(item)))].slice(0,20),filters:value.filters&&typeof value.filters==='object'?JSON.parse(JSON.stringify(value.filters)):{},focus:FOCUS.has(String(value.focus))?String(value.focus):'now',createdAt:Math.max(0,Number(value.createdAt||0)),updatedAt:Math.max(0,Number(value.updatedAt||0))};}

export function listNavigatorWorkspaces(snapshot = {}) {
  const saved=(snapshot.sessionNavigator?.workspaces||[]).map(safeWorkspace).filter(item=>item.id&&item.label);const ids=new Set(saved.map(item=>item.id));return[...saved,...DEFAULT_NAVIGATOR_WORKSPACES.filter(item=>!ids.has(item.id)).map(safeWorkspace)];
}

export function previewWorkspaceImpact(snapshot = {}, workspace = {}) {
  const target=safeWorkspace(workspace);const current=String(snapshot.sessionNavigator?.activeWorkspaceId||'');
  return{id:`workspace-preview-${target.id}-${snapshot.updatedAt||0}`,workspace:target,changes:{workspace:current!==target.id,visiblePanels:target.visiblePanels.length,filters:Object.keys(target.filters).length,focus:target.focus},reversible:true,protectedQuestions:(snapshot.ledger||[]).filter(item=>!['proven','archived'].includes(item.state)).length,providerWrites:false};
}

export function validateWorkspaceApply(preview = {}, workspace = {}) {
  const target=safeWorkspace(workspace);if(!preview?.id||preview.workspace?.id!==target.id)return{ok:false,error:'workspace_preview_mismatch'};if(!target.id||!target.label)return{ok:false,error:'workspace_invalid'};return{ok:true,workspace:target};
}

export function exportWorkspaceMetadata(workspaces = []) {
  return{schema:'pmia.navigator.workspaces.v1',exportedAt:Date.now(),workspaces:workspaces.map(safeWorkspace).map(item=>({...item,filters:{...item.filters}}))};
}
