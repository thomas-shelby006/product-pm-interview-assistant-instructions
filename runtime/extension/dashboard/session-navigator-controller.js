import { SESSION_NAVIGATOR_TABS } from '../shared/session-navigator-state.js';

function safeTab(value, fallback = 'now') {
  return SESSION_NAVIGATOR_TABS.includes(String(value)) ? String(value) : fallback;
}

export function createSessionNavigatorLocalState(value = {}) {
  return {
    open: Boolean(value.open),
    activeTab: safeTab(value.activeTab),
    query: String(value.query || '').slice(0, 200),
    selectedIndex: Math.max(0, Number(value.selectedIndex || 0)),
    selectedEntityId: String(value.selectedEntityId || '').slice(0, 160),
    recent: Array.isArray(value.recent) ? value.recent.slice(-24).map(item => ({ ...item })) : []
  };
}

export function openSessionNavigator(value = {}, tab = 'now') {
  return { ...createSessionNavigatorLocalState(value), open: true, activeTab: safeTab(tab) };
}

export function closeSessionNavigator(value = {}) {
  return { ...createSessionNavigatorLocalState(value), open: false };
}

export function selectSessionNavigatorTab(value = {}, tab) {
  const state = createSessionNavigatorLocalState(value);
  return { ...state, activeTab: safeTab(tab, state.activeTab), selectedIndex: 0, selectedEntityId: '' };
}

export function moveSessionNavigatorTab(value = {}, delta = 1) {
  const state = createSessionNavigatorLocalState(value);
  const current = SESSION_NAVIGATOR_TABS.indexOf(state.activeTab);
  const next = (current + Number(delta || 0) + SESSION_NAVIGATOR_TABS.length) % SESSION_NAVIGATOR_TABS.length;
  return { ...state, activeTab: SESSION_NAVIGATOR_TABS[next], selectedIndex: 0, selectedEntityId: '' };
}

export function setSessionNavigatorQuery(value = {}, query = '') {
  return { ...createSessionNavigatorLocalState(value), query: String(query || '').slice(0, 200), selectedIndex: 0 };
}

export function selectSessionNavigatorResult(value = {}, entityId = '', index = 0) {
  return { ...createSessionNavigatorLocalState(value), selectedEntityId: String(entityId || '').slice(0, 160), selectedIndex: Math.max(0, Number(index || 0)) };
}

export function recordLocalNavigatorVisit(value = {}, visit = {}, now = Date.now()) {
  const state = createSessionNavigatorLocalState(value);
  const entry = {
    id: String(visit.id || `${now}-${visit.tab || state.activeTab}`).slice(0, 160),
    tab: safeTab(visit.tab, state.activeTab),
    entityType: String(visit.entityType || '').slice(0, 40),
    entityId: String(visit.entityId || '').slice(0, 160),
    at: Math.max(0, Number(now || 0))
  };
  return { ...state, recent: [...state.recent.filter(item => item.id !== entry.id), entry].slice(-24) };
}

export function navigatorQuickOpenFromKeyboard(event, value = {}) {
  const key = String(event?.key || '').toLowerCase();
  const open = (Boolean(event?.ctrlKey) || Boolean(event?.metaKey)) && Boolean(event?.shiftKey) && key === 'n';
  return open ? openSessionNavigator(value, 'now') : createSessionNavigatorLocalState(value);
}

export function navigatorTabFromKey(event, value = {}) {
  if (!event || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return createSessionNavigatorLocalState(value);
  if (event.key === 'Home') return selectSessionNavigatorTab(value, SESSION_NAVIGATOR_TABS[0]);
  if (event.key === 'End') return selectSessionNavigatorTab(value, SESSION_NAVIGATOR_TABS.at(-1));
  return moveSessionNavigatorTab(value, event.key === 'ArrowRight' ? 1 : -1);
}
