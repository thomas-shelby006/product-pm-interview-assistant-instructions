import { deriveSessionNavigatorNow } from './session-navigator-now-model.js';
import { buildSessionSearchIndex, searchSessionEntities, buildSearchPreview, recentNavigatorHistory } from './session-navigator-search-model.js';
import { buildQuestionThreadGraph, questionFollowUpChain, deriveThreadCompletion, dependencyMarkers } from './session-navigator-thread-model.js';
import { derivePaceBaseline, answerDurationBands, segmentTimeRemaining, silenceDeviation, derivePaceGuidance } from './session-navigator-pace-model.js';
import { deriveHandoffBoard } from './session-navigator-handoff-model.js';
import { listNavigatorWorkspaces } from './session-navigator-workspace-model.js';
import { SESSION_SCENARIOS, scenarioTrainingState } from './session-navigator-scenario-model.js';
import { deriveBookmarkNavigator, bookmarkCategories, bookmarkReviewQueue } from './session-navigator-bookmark-model.js';
import { deriveGoalCoverageMatrix, prioritizeGoalGaps, derivePhaseCoverage } from './session-navigator-goal-model.js';
import { deriveGuidedDebrief } from './session-navigator-debrief-model.js';

export function deriveSessionNavigator(snapshot = {}, local = {}, now = Date.now(), options = {}) {
  const cached = options.base?._cache || null;
  const index=cached?.searchIndex || buildSessionSearchIndex(snapshot);const results=searchSessionEntities(index,local.query||'',60);const selected=results[Math.max(0,Math.min(results.length-1,Number(local.selectedIndex||0)))]||null;
  const threads=cached?.threadGraph || buildQuestionThreadGraph(snapshot);const selectedQuestionId=String(local.selectedEntityId || (selected?.type==='question' ? selected.id : ''));const selectedRoot=selectedQuestionId&&threads.nodes[selectedQuestionId]?questionFollowUpChain(threads,selectedQuestionId)[0]?.id:threads.roots[0];
  const paceBaseline=derivePaceBaseline(snapshot);
  const debrief=deriveGuidedDebrief(snapshot);
  const completedRoleExport=(snapshot.commandJournal||[]).some(item=>item?.command==='export_session' && item?.result?.ok===true && Array.isArray(item.result.exportedTabIds) && item.result.exportedTabIds.length===2);
  const postInterview={exportComplete:completedRoleExport,debriefExported:Number(snapshot.sessionNavigator?.debriefExports||0)>0,reviewReady:completedRoleExport&&debrief.exportReady};
  const breadcrumbsNow=deriveSessionNavigatorNow({...snapshot,postInterview},local,now);
  return{
    ...breadcrumbsNow,
    search:{query:String(local.query||''),results,selected,preview:buildSearchPreview(selected),recent:recentNavigatorHistory(snapshot.sessionNavigator?.history||[],local.recent||[])},
    threads:{graph:threads,selectedId:selectedQuestionId,chain:questionFollowUpChain(threads,selectedQuestionId),completion:selectedRoot?deriveThreadCompletion(threads,selectedRoot):null,dependencies:dependencyMarkers(threads)},
    pace:{baseline:paceBaseline,bands:answerDurationBands(snapshot,paceBaseline),segment:segmentTimeRemaining(snapshot,now),silence:silenceDeviation(snapshot,paceBaseline,now),guidance:derivePaceGuidance(snapshot,now)},
    handoff:deriveHandoffBoard(snapshot),
    workspaces:{items:listNavigatorWorkspaces(snapshot),activeId:String(snapshot.sessionNavigator?.activeWorkspaceId||'')},
    scenarios:SESSION_SCENARIOS.map(item=>scenarioTrainingState(snapshot,item.id)),
    bookmarks:{...deriveBookmarkNavigator(snapshot,local.bookmarks||{}),categories:bookmarkCategories(snapshot),reviewQueue:bookmarkReviewQueue(snapshot)},
    goals:{matrix:deriveGoalCoverageMatrix(snapshot),gaps:prioritizeGoalGaps(snapshot),phaseCoverage:derivePhaseCoverage(snapshot)},
    debrief,
    postInterview,
    _cache:{searchIndex:index,threadGraph:threads}
  };
}

