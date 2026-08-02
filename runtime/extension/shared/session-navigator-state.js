const TABS = Object.freeze(['now','search','threads','pace','handoff','workspaces','scenarios','bookmarks','goals','debrief']);
const PHASES = Object.freeze(['prelaunch','launch','live','export','review','shutdown']);
const MAX_HISTORY = 48;
const MAX_BOOKMARKS = 96;
const MAX_GOALS = 32;
const MAX_WORKSPACES = 12;
const MAX_COVERAGE = 256;

function text(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

function time(value) {
  return Math.max(0, Number(value || 0));
}

function uniqueStrings(values, max = 24, size = 120) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => text(value, size)).filter(Boolean))].slice(0, max);
}

function normalizeHistory(values = []) {
  return (Array.isArray(values) ? values : []).map(item => ({
    id: text(item?.id, 160),
    tab: TABS.includes(String(item?.tab)) ? String(item.tab) : 'now',
    entityType: text(item?.entityType, 40),
    entityId: text(item?.entityId, 160),
    reason: text(item?.reason, 80),
    at: time(item?.at)
  })).filter(item => item.id && item.at).slice(-MAX_HISTORY);
}

function normalizeBookmarks(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).map(item => ({
    id: text(item?.id, 160),
    targetType: text(item?.targetType, 40),
    targetId: text(item?.targetId, 160),
    category: text(item?.category || 'evidence', 40),
    label: text(item?.label, 160),
    createdAt: time(item?.createdAt),
    reviewedAt: time(item?.reviewedAt)
  })).filter(item => {
    if (!item.id || !item.targetType || !item.targetId || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(-MAX_BOOKMARKS);
}

function normalizeGoals(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).map(item => ({
    id: text(item?.id, 120),
    label: text(item?.label, 160),
    targetCount: Math.max(1, Math.min(50, Number(item?.targetCount || 1))),
    priority: ['low','normal','high','critical'].includes(String(item?.priority)) ? String(item.priority) : 'normal',
    phases: uniqueStrings(item?.phases, 6, 40),
    updatedAt: time(item?.updatedAt)
  })).filter(item => {
    if (!item.id || !item.label || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(-MAX_GOALS);
}

function normalizeCoverage(value = {}) {
  const output = {};
  for (const [questionId, goalIds] of Object.entries(value && typeof value === 'object' ? value : {})) {
    const id = text(questionId, 160);
    if (id) output[id] = uniqueStrings(goalIds, MAX_GOALS, 120);
    if (Object.keys(output).length >= MAX_COVERAGE) break;
  }
  return output;
}

function normalizeWorkspaces(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).map(item => ({
    id: text(item?.id, 120),
    label: text(item?.label, 160),
    visiblePanels: uniqueStrings(item?.visiblePanels, 20, 60),
    filters: item?.filters && typeof item.filters === 'object' ? JSON.parse(JSON.stringify(item.filters)) : {},
    focus: text(item?.focus || 'now', 60),
    createdAt: time(item?.createdAt),
    updatedAt: time(item?.updatedAt)
  })).filter(item => {
    if (!item.id || !item.label || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(-MAX_WORKSPACES);
}

export function normalizeSessionNavigator(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: 1,
    enabled: source.enabled !== false,
    defaultTab: TABS.includes(String(source.defaultTab)) ? String(source.defaultTab) : 'now',
    lastOpenedAt: time(source.lastOpenedAt),
    history: normalizeHistory(source.history),
    bookmarks: normalizeBookmarks(source.bookmarks),
    goals: normalizeGoals(source.goals),
    coverage: normalizeCoverage(source.coverage),
    workspaces: normalizeWorkspaces(source.workspaces),
    activeWorkspaceId: text(source.activeWorkspaceId, 120),
    scenarioCompletion: uniqueStrings(source.scenarioCompletion, 64, 120),
    debriefExports: Math.max(0, Number(source.debriefExports || 0))
  };
}

export function touchSessionNavigator(value = {}, now = Date.now()) {
  return { ...normalizeSessionNavigator(value), lastOpenedAt: time(now) };
}

export function recordNavigatorHistory(value = {}, entry = {}, now = Date.now()) {
  const state = normalizeSessionNavigator(value);
  const tab = TABS.includes(String(entry.tab)) ? String(entry.tab) : 'now';
  const next = {
    id: text(entry.id || `${now}-${tab}-${entry.entityId || 'view'}`, 160),
    tab,
    entityType: text(entry.entityType, 40),
    entityId: text(entry.entityId, 160),
    reason: text(entry.reason || 'operator_navigation', 80),
    at: time(now)
  };
  return { ...state, lastOpenedAt: time(now), history: normalizeHistory([...state.history, next]) };
}

export function upsertNavigatorBookmark(value = {}, bookmark = {}, now = Date.now()) {
  const state = normalizeSessionNavigator(value);
  const id = text(bookmark.id || `bookmark-${now}`, 160);
  const next = normalizeBookmarks([
    ...state.bookmarks.filter(item => item.id !== id),
    { ...bookmark, id, createdAt: bookmark.createdAt || now }
  ]);
  return { ok: true, id, value: { ...state, bookmarks: next } };
}

export function removeNavigatorBookmark(value = {}, bookmarkId) {
  const state = normalizeSessionNavigator(value);
  const id = text(bookmarkId, 160);
  return { ok: Boolean(id), value: { ...state, bookmarks: state.bookmarks.filter(item => item.id !== id) } };
}

export function upsertNavigatorGoal(value = {}, goal = {}, now = Date.now()) {
  const state = normalizeSessionNavigator(value);
  const id = text(goal.id || `goal-${now}`, 120);
  const next = normalizeGoals([...state.goals.filter(item => item.id !== id), { ...goal, id, updatedAt: now }]);
  return { ok: true, id, value: { ...state, goals: next } };
}

export function tagNavigatorCoverage(value = {}, questionId, goalIds = []) {
  const state = normalizeSessionNavigator(value);
  const id = text(questionId, 160);
  if (!id) return { ok: false, error: 'question_id_required', value: state };
  return { ok: true, value: { ...state, coverage: normalizeCoverage({ ...state.coverage, [id]: goalIds }) } };
}

export function upsertNavigatorWorkspace(value = {}, workspace = {}, now = Date.now()) {
  const state = normalizeSessionNavigator(value);
  const id = text(workspace.id || `workspace-${now}`, 120);
  const previous = state.workspaces.find(item => item.id === id);
  const next = normalizeWorkspaces([
    ...state.workspaces.filter(item => item.id !== id),
    { ...previous, ...workspace, id, createdAt: previous?.createdAt || now, updatedAt: now }
  ]);
  return { ok: true, id, value: { ...state, workspaces: next, activeWorkspaceId: id } };
}

export function markNavigatorScenarioComplete(value = {}, scenarioId) {
  const state = normalizeSessionNavigator(value);
  const id = text(scenarioId, 120);
  if (!id) return { ok: false, error: 'scenario_id_required', value: state };
  return { ok: true, value: { ...state, scenarioCompletion: uniqueStrings([...state.scenarioCompletion, id], 64, 120) } };
}

export function recordNavigatorDebriefExport(value = {}) {
  const state = normalizeSessionNavigator(value);
  return { ...state, debriefExports: state.debriefExports + 1 };
}

export const SESSION_NAVIGATOR_TABS = TABS;
export const SESSION_NAVIGATOR_PHASES = PHASES;
