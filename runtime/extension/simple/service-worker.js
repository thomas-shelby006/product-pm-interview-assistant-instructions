import { createSimpleCoordinator } from './coordinator.js';
import { createSimplePortRouter } from './port-router.js';
import { createStageLog } from './stage-log.js';
import { launchSimpleSession } from './launch.js';
import { launchIsReady } from './launch-status.js';
import { buildSessionMeta, deriveEndState, managedWindowIds, providerLoginBlocker, roleWindowId } from './session-tools.js';
import { buildSessionSummary } from './session-summary.js';
import { normalizeMarkers, upsertMarker } from './markers.js';

const UNRESOLVED_KEY = 'pmia_simple_unresolved_v1';
const STAGE_PREFIX = 'pmia_simple_stages_v1_';
const META_PREFIX = 'pmia_simple_meta_v1_';
const MARKER_PREFIX = 'pmia_simple_markers_v1_';
const rolePorts = new Map();
const uiPorts = new Map();
const stageLogs = new Map();
const stageLoads = new Map();
const metaCache = new Map();
const inspectionPending = new Map();
let unresolvedChain = Promise.resolve();
let requestSeq = 0;

const roleKey = (sessionId, role) => `${sessionId}:${role}`;
const stageKey = sessionId => `${STAGE_PREFIX}${sessionId}`;
const metaKey = sessionId => `${META_PREFIX}${sessionId}`;
const markerKey = sessionId => `${MARKER_PREFIX}${sessionId}`;

function unresolvedMutation(change) {
  unresolvedChain = unresolvedChain.then(async () => {
    const stored = await chrome.storage.session.get(UNRESOLVED_KEY);
    const values = { ...(stored?.[UNRESOLVED_KEY] || {}) };
    change(values);
    await chrome.storage.session.set({ [UNRESOLVED_KEY]:values });
  });
  return unresolvedChain;
}

const unresolvedStore = {
  put(key, value) { return unresolvedMutation(values => { values[key] = value; }); },
  remove(key) { return unresolvedMutation(values => { delete values[key]; }); },
  async list() {
    await unresolvedChain;
    const stored = await chrome.storage.session.get(UNRESOLVED_KEY);
    return Object.entries(stored?.[UNRESOLVED_KEY] || {});
  }
};

function loadStageLog(sessionId) {
  if (stageLogs.has(sessionId)) return Promise.resolve(stageLogs.get(sessionId));
  if (stageLoads.has(sessionId)) return stageLoads.get(sessionId);
  const pending = chrome.storage.session.get(stageKey(sessionId)).then(stored => {
    if (!stageLogs.has(sessionId)) {
      stageLogs.set(sessionId, createStageLog({ initial:stored?.[stageKey(sessionId)] || [] }));
    }
    return stageLogs.get(sessionId);
  }).finally(() => stageLoads.delete(sessionId));
  stageLoads.set(sessionId, pending);
  return pending;
}

async function loadMeta(sessionId) {
  if (metaCache.has(sessionId)) return metaCache.get(sessionId);
  const stored = await chrome.storage.session.get(metaKey(sessionId));
  const meta = stored?.[metaKey(sessionId)] || null;
  if (meta) metaCache.set(sessionId, meta);
  return meta;
}

async function saveMeta(meta) {
  metaCache.set(meta.sessionId, meta);
  await chrome.storage.session.set({ [metaKey(meta.sessionId)]:meta });
  return meta;
}

async function loadMarkers(sessionId) {
  const stored = await chrome.storage.session.get(markerKey(sessionId));
  return normalizeMarkers(stored?.[markerKey(sessionId)] || []);
}

async function unresolvedForSession(sessionId) {
  const prefix = `${sessionId}:`;
  return (await unresolvedStore.list()).filter(([key]) => key.startsWith(prefix));
}

function publishSnapshot(sessionId) {
  const snapshot = {
    sessionId,
    version:chrome.runtime.getManifest().version,
    roles:Object.fromEntries(['sender','receiver','comparison'].map(role => [role, rolePorts.has(roleKey(sessionId, role))])),
    stages:stageLogs.get(sessionId)?.snapshot() || [],
    meta:metaCache.get(sessionId) || null
  };
  for (const [port, value] of uiPorts) {
    if (value.sessionId !== sessionId) continue;
    try { port.postMessage({ type:'snapshot', snapshot }); } catch {}
  }
  return snapshot;
}

function recordStage(value = {}) {
  const sessionId = String(value.sessionId || '').trim();
  if (!sessionId) return;
  void loadStageLog(sessionId).then(log => {
    if (!log.append(value)) return;
    const stages = log.snapshot();
    return chrome.storage.session.set({ [stageKey(sessionId)]:stages }).then(() => publishSnapshot(sessionId));
  });
}

const coordinator = createSimpleCoordinator({ unresolvedStore });
const router = createSimplePortRouter({
  coordinator,
  onStage:recordStage,
  onRegister(value) {
    rolePorts.set(roleKey(value.sessionId, value.role), value.port);
    void Promise.all([loadMeta(value.sessionId), loadStageLog(value.sessionId)]).then(() => {
      publishSnapshot(value.sessionId);
      if (value.role === 'receiver' || value.role === 'comparison') {
        return coordinator.retryRole(value.sessionId, value.role);
      }
      return null;
    });
  }
});

async function detectLaunchBlocker(sessionId, launch) {
  for (let index = 0; index < (launch.roles || []).length; index += 1) {
    const value = launch.roles[index];
    const windowId = launch.providerWindows?.[index]?.id;
    if (!Number.isFinite(windowId) || rolePorts.has(roleKey(sessionId, value.role))) continue;
    const win = await chrome.windows.get(windowId, { populate:true }).catch(() => null);
    const tab = win?.tabs?.[0];
    const blocker = providerLoginBlocker({ role:value.role, provider:value.provider, url:tab?.url || tab?.pendingUrl, title:tab?.title });
    if (blocker) return blocker;
  }
  return null;
}

async function launchFromStudio(message) {
  const sessionId = String(message.sessionId || '').trim();
  const comparisonProvider = String(message.comparisonProvider || '').trim();
  const roles = ['sender','receiver', ...(comparisonProvider ? ['comparison'] : [])];
  const startedAt = Date.now();
  const launch = await launchSimpleSession({
    sessionId,
    senderProvider:message.senderProvider,
    receiverProvider:message.receiverProvider,
    comparisonProvider,
    bounds:message.bounds,
    chatgptUrl:message.chatgptUrl,
    claudeUrl:message.claudeUrl,
    cockpitUrl:chrome.runtime.getURL('cockpit/index.html'),
    createWindow:spec => chrome.windows.create(spec)
  });
  const meta = await saveMeta(buildSessionMeta({ sessionId, roles:launch.roles, launch, startedAt }));
  const deadline = Date.now() + 35000;
  let blocker = null;
  while (Date.now() <= deadline && !roles.every(role => rolePorts.has(roleKey(sessionId, role)))) {
    if (Date.now() >= startedAt + 1200) blocker = await detectLaunchBlocker(sessionId, launch);
    if (blocker) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const rolesReady = !blocker && roles.every(role => rolePorts.has(roleKey(sessionId, role)));
  const bootText = String(message.bootText || '').trim();
  let boot = null;
  if (rolesReady && bootText) boot = await coordinator.dispatchBoot({ sessionId, text:bootText });
  const ok = rolesReady && launchIsReady({ roles, hasBoot:Boolean(bootText), boot });
  publishSnapshot(sessionId);
  return { ok, sessionId, launch, boot, roles, meta, errorCode:blocker?.code || '', blocker,
    error:ok ? '' : (blocker?.detail || (rolesReady ? 'boot_not_rendered' : 'provider_not_ready')) };
}

function controlSender(sessionId, command, payload = {}) {
  const port = rolePorts.get(roleKey(sessionId, 'sender'));
  if (!port) return false;
  port.postMessage({ type:'control', command, ...payload });
  return true;
}

function inspectRole(sessionId, role, scope = 'review', timeoutMs = 1500) {
  const port = rolePorts.get(roleKey(sessionId, role));
  if (!port) return Promise.resolve({ available:false, role, reason:'disconnected' });
  const requestId = `inspect-${Date.now()}-${++requestSeq}`;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      inspectionPending.delete(requestId);
      resolve({ available:false, role, reason:'unavailable' });
    }, timeoutMs);
    inspectionPending.set(requestId, { resolve, timer });
    try { port.postMessage({ type:'inspect_request', requestId, scope }); }
    catch {
      clearTimeout(timer);
      inspectionPending.delete(requestId);
      resolve({ available:false, role, reason:'disconnected' });
    }
  });
}

async function focusWindow(sessionId, role) {
  const meta = await loadMeta(sessionId);
  const id = roleWindowId(meta, role);
  if (!id) return { ok:false, reason:'window_missing' };
  try {
    await chrome.windows.update(id, { focused:true });
    return { ok:true, role };
  } catch { return { ok:false, reason:'window_missing' }; }
}

async function restoreLayout(sessionId) {
  const meta = await loadMeta(sessionId);
  if (!meta?.layout) return { ok:false, reason:'layout_missing' };
  const roles = Object.keys(meta.roles || {});
  const updates = roles.map((role, index) => {
    const id = roleWindowId(meta, role);
    const bounds = meta.layout.providers?.[index];
    return id && bounds ? chrome.windows.update(id, { ...bounds, state:'normal' }).catch(() => null) : null;
  }).filter(Boolean);
  const cockpitId = roleWindowId(meta, 'cockpit');
  if (cockpitId && meta.layout.cockpit) updates.push(chrome.windows.update(cockpitId, { ...meta.layout.cockpit, state:'normal' }).catch(() => null));
  await Promise.all(updates);
  return { ok:true, updated:updates.length };
}

async function reviewData(sessionId) {
  const [meta] = await Promise.all([loadMeta(sessionId), loadStageLog(sessionId)]);
  const markers = await loadMarkers(sessionId);
  const unresolved = await unresolvedForSession(sessionId);
  const roles = ['sender','receiver', ...(meta?.roles?.comparison ? ['comparison'] : [])];
  const inspections = await Promise.all(roles.map(role => inspectRole(sessionId, role)));
  const inspection = Object.fromEntries(inspections.map(value => [value.role, value]));
  const snapshot = publishSnapshot(sessionId);
  return {
    meta,
    snapshot:{ ...snapshot, stages:snapshot.stages.slice(-20) },
    summary:buildSessionSummary(snapshot, markers),
    markers,
    unresolvedCount:unresolved.length,
    inspection
  };
}

async function markQuestion(sessionId, message) {
  const current = await loadMarkers(sessionId);
  const next = upsertMarker(current, {
    sessionId,
    turnId:String(message.turnId || ''),
    category:String(message.category || ''),
    at:Date.now()
  });
  await chrome.storage.session.set({ [markerKey(sessionId)]:next });
  return { ok:true, markers:next };
}

async function endState(sessionId) {
  const unresolved = await unresolvedForSession(sessionId);
  return deriveEndState(unresolved.length);
}

async function endSession(sessionId, force = false) {
  const state = await endState(sessionId);
  if (!state.canEnd && !force) return { ok:false, reason:'unresolved', unresolvedCount:state.unresolvedCount };
  const meta = await loadMeta(sessionId);
  const ids = managedWindowIds(meta);
  const settled = await Promise.allSettled(ids.map(id => chrome.windows.remove(id)));
  const closed = settled.filter(value => value.status === 'fulfilled').length;
  return { ok:true, closed, failed:settled.length - closed, unresolvedCount:state.unresolvedCount };
}

async function handleUiCommand(message) {
  const sessionId = String(message.sessionId || '').trim();
  switch (String(message.command || '')) {
    case 'focus_window': return focusWindow(sessionId, String(message.role || ''));
    case 'restore_layout': return restoreLayout(sessionId);
    case 'get_review_data': return { ok:true, data:await reviewData(sessionId) };
    case 'mark_question': return markQuestion(sessionId, message);
    case 'get_end_state': return { ok:true, ...(await endState(sessionId)) };
    case 'end_session': return endSession(sessionId, Boolean(message.force));
    default: return { ok:false, reason:'unknown_command' };
  }
}

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'pmia-simple') return;
  router.attach(port);

  port.onMessage.addListener(message => {
    if (message?.type === 'inspect_result' && message.requestId) {
      const pending = inspectionPending.get(message.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        inspectionPending.delete(message.requestId);
        pending.resolve(message.result || { available:false, reason:'invalid_result' });
      }
      return;
    }
    if (message?.type === 'turn' && message.turn) {
      recordStage({ sessionId:message.turn.sessionId, role:'system', turnId:message.turn.turnId, stage:'fanout' });
      return;
    }
    if (message?.type === 'ui_register') {
      const sessionId = String(message.sessionId || '').trim();
      uiPorts.set(port, { sessionId, client:String(message.client || 'ui') });
      void Promise.all([loadMeta(sessionId), loadStageLog(sessionId)]).then(() => port.postMessage({ type:'snapshot', snapshot:publishSnapshot(sessionId) }));
      return;
    }
    if (message?.type === 'get_snapshot') {
      const sessionId = String(message.sessionId || '');
      void Promise.all([loadMeta(sessionId), loadStageLog(sessionId)]).then(() => port.postMessage({ type:'snapshot', snapshot:publishSnapshot(sessionId) }));
      return;
    }
    if (message?.type === 'control') {
      const ok = controlSender(String(message.sessionId || ''), String(message.command || ''), message);
      port.postMessage({ type:'control_result', requestId:message.requestId || '', ok });
      return;
    }
    if (message?.type === 'ui_command') {
      void handleUiCommand(message).then(result => {
        port.postMessage({ type:'ui_result', requestId:message.requestId || '', result });
      }).catch(error => {
        port.postMessage({ type:'ui_result', requestId:message.requestId || '', result:{ ok:false, reason:String(error?.message || error) } });
      });
      return;
    }
    if (message?.type === 'boot') {
      void coordinator.dispatchBoot({ sessionId:message.sessionId, text:message.text }).then(result => {
        port.postMessage({ type:'boot_result', requestId:message.requestId || '', result });
      });
      return;
    }
    if (message?.type === 'launch_session') {
      void launchFromStudio(message).then(result => {
        port.postMessage({ type:'launch_result', requestId:message.requestId || '', result });
      }).catch(error => {
        port.postMessage({ type:'launch_result', requestId:message.requestId || '', result:{ ok:false, error:String(error?.message || error) } });
      });
    }
  });

  port.onDisconnect.addListener(() => {
    const ui = uiPorts.get(port);
    uiPorts.delete(port);
    const affected = new Set(ui?.sessionId ? [ui.sessionId] : []);
    for (const [key, value] of rolePorts) {
      if (value !== port) continue;
      rolePorts.delete(key);
      affected.add(key.slice(0, key.lastIndexOf(':')));
    }
    for (const sessionId of affected) publishSnapshot(sessionId);
  });
});

chrome.action.onClicked.addListener(async () => {
  const current = await chrome.windows.getCurrent().catch(() => null);
  const width = 980;
  const height = 720;
  const left = current ? Math.round(current.left + Math.max(0, (current.width - width) / 2)) : undefined;
  const top = current ? Math.round(current.top + Math.max(0, (current.height - height) / 2)) : undefined;
  await chrome.windows.create({
    url:chrome.runtime.getURL('studio/index.html'),
    type:'popup',
    focused:true,
    width,
    height,
    ...(Number.isFinite(left) ? { left } : {}),
    ...(Number.isFinite(top) ? { top } : {})
  });
});
