import { normalizeSessionNavigator } from './session-navigator-state.js';

const TABS=new Set(['now','search','threads','pace','handoff','workspaces','scenarios','bookmarks','goals','debrief']);

export function auditSessionNavigator(snapshot = {}, now = Date.now()) {
  const value=normalizeSessionNavigator(snapshot.sessionNavigator||{});const ledgerIds=new Set((snapshot.ledger||[]).map(item=>String(item.id||'')));const markerIds=new Set((snapshot.operatorMarkers||[]).map(item=>String(item.id||'')));const incidentKnown=Array.isArray(snapshot.incidents?.items);const incidentIds=new Set((snapshot.incidents?.items||[]).map(item=>String(item.id||'')));const sessionId=String(snapshot.sessionId||'');
  const errors=[];
  for(const item of value.history){if(!TABS.has(item.tab))errors.push({code:'navigator_history_tab_invalid',id:item.id});}
  for(const bookmark of value.bookmarks){const target=bookmark.targetType==='question'?ledgerIds:bookmark.targetType==='marker'?markerIds:bookmark.targetType==='incident'?(incidentKnown?incidentIds:null):bookmark.targetType==='session'?new Set([sessionId]):null;if(target&&!target.has(bookmark.targetId))errors.push({code:'navigator_bookmark_stale',id:bookmark.id,targetId:bookmark.targetId});}
  for(const [questionId,goalIds] of Object.entries(value.coverage)){if(!ledgerIds.has(questionId))errors.push({code:'navigator_coverage_question_stale',questionId});const known=new Set(value.goals.map(goal=>goal.id));for(const goalId of goalIds)if(!known.has(goalId))errors.push({code:'navigator_coverage_goal_stale',questionId,goalId});}
  if(value.activeWorkspaceId&&!value.workspaces.some(item=>item.id===value.activeWorkspaceId)&&!['live_focus','recovery','debrief'].includes(value.activeWorkspaceId))errors.push({code:'navigator_workspace_stale',workspaceId:value.activeWorkspaceId});
  return{ok:errors.length===0,errors,count:errors.length,evaluatedAt:Number(now)};
}

export function repairSessionNavigator(snapshot = {}, now = Date.now()) {
  const value=normalizeSessionNavigator(snapshot.sessionNavigator||{});const ledgerIds=new Set((snapshot.ledger||[]).map(item=>String(item.id||'')));const markerIds=new Set((snapshot.operatorMarkers||[]).map(item=>String(item.id||'')));const incidentKnown=Array.isArray(snapshot.incidents?.items);const incidentIds=new Set((snapshot.incidents?.items||[]).map(item=>String(item.id||'')));const goalIds=new Set(value.goals.map(item=>item.id));const sessionId=String(snapshot.sessionId||'');
  const exists=item=>item.targetType==='question'?ledgerIds.has(item.targetId):item.targetType==='marker'?markerIds.has(item.targetId):item.targetType==='incident'?(incidentKnown?incidentIds.has(item.targetId):true):item.targetType==='session'?item.targetId===sessionId:true;
  const coverage={};for(const [questionId,ids] of Object.entries(value.coverage))if(ledgerIds.has(questionId)){const kept=ids.filter(id=>goalIds.has(id));if(kept.length)coverage[questionId]=kept;}
  return{...value,bookmarks:value.bookmarks.filter(exists),coverage,activeWorkspaceId:value.workspaces.some(item=>item.id===value.activeWorkspaceId)||['live_focus','recovery','debrief'].includes(value.activeWorkspaceId)?value.activeWorkspaceId:'',history:value.history.filter(item=>TABS.has(item.tab)).slice(-48),repairedAt:Number(now)};
}
