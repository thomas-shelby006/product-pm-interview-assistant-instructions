import { normalizeSessionNavigator } from './session-navigator-state.js';

const LIMITS = Object.freeze({ targetBytes: 192 * 1024, warningBytes: 384 * 1024, criticalBytes: 768 * 1024 });

export function estimateNavigatorBytes(value = {}) {
  return new TextEncoder().encode(JSON.stringify(normalizeSessionNavigator(value))).byteLength;
}

export function deriveNavigatorBudget(value = {}) {
  const normalized=normalizeSessionNavigator(value);const bytes=estimateNavigatorBytes(normalized);const level=bytes>=LIMITS.criticalBytes?'critical':bytes>=LIMITS.warningBytes?'warning':'normal';
  return{bytes,level,limits:{...LIMITS},percentOfCritical:Number((bytes/LIMITS.criticalBytes*100).toFixed(1)),counts:{history:normalized.history.length,bookmarks:normalized.bookmarks.length,goals:normalized.goals.length,coverage:Object.keys(normalized.coverage).length,workspaces:normalized.workspaces.length,scenarios:normalized.scenarioCompletion.length},action:level==='critical'?'compact_navigator':level==='warning'?'review_navigator_growth':'none'};
}

export function compactNavigatorMetadata(value = {}, options = {}) {
  const state=normalizeSessionNavigator(value);const keepHistory=Math.max(8,Math.min(48,Number(options.keepHistory||24)));const keepBookmarks=Math.max(16,Math.min(96,Number(options.keepBookmarks||64)));
  const validGoalIds=new Set(state.goals.map(item=>item.id));const coverage={};for(const [questionId,ids] of Object.entries(state.coverage)){const kept=ids.filter(id=>validGoalIds.has(id));if(kept.length)coverage[questionId]=kept;}
  const next=normalizeSessionNavigator({...state,history:state.history.slice(-keepHistory),bookmarks:state.bookmarks.slice(-keepBookmarks),coverage});
  return{value:next,beforeBytes:estimateNavigatorBytes(state),afterBytes:estimateNavigatorBytes(next),removed:{history:state.history.length-next.history.length,bookmarks:state.bookmarks.length-next.bookmarks.length,coverage:Object.keys(state.coverage).length-Object.keys(next.coverage).length}};
}

export const SESSION_NAVIGATOR_BUDGET_LIMITS = LIMITS;
