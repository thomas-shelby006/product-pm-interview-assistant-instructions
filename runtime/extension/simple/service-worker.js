import { createSimpleCoordinator } from './coordinator.js';
import { createSimplePortRouter } from './port-router.js';
import { createStageLog } from './stage-log.js';
import { launchSimpleSession } from './launch.js';
import { launchIsReady } from './launch-status.js';

const UNRESOLVED_KEY = 'pmia_simple_unresolved_v1';
const STAGE_PREFIX = 'pmia_simple_stages_v1_';
const rolePorts = new Map();
const uiPorts = new Map();
const stageLogs = new Map();
let unresolvedChain = Promise.resolve();

const roleKey = (sessionId, role) => `${sessionId}:${role}`;
const stageKey = sessionId => `${STAGE_PREFIX}${sessionId}`;

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
function getStageLog(sessionId) {
  if (!stageLogs.has(sessionId)) stageLogs.set(sessionId, createStageLog());
  return stageLogs.get(sessionId);
}

function publishSnapshot(sessionId) {
  const snapshot = {
    sessionId,
    roles:Object.fromEntries(['sender','receiver','comparison'].map(role => [role, rolePorts.has(roleKey(sessionId, role))])),
    stages:getStageLog(sessionId).snapshot()
  };
  for (const [port, value] of uiPorts) {
    if (value.sessionId !== sessionId) continue;
    try { port.postMessage({ type:'snapshot', snapshot }); } catch {}
  }
  return snapshot;
}

function recordStage(value = {}) {
  const sessionId = String(value.sessionId || '').trim();
  if (!sessionId || !getStageLog(sessionId).append(value)) return;
  const snapshot = getStageLog(sessionId).snapshot();
  void chrome.storage.session.set({ [stageKey(sessionId)]:snapshot });
  publishSnapshot(sessionId);
}

const coordinator = createSimpleCoordinator({ unresolvedStore });
const router = createSimplePortRouter({
  coordinator,
  onStage:recordStage,
  onRegister(value) {
    rolePorts.set(roleKey(value.sessionId, value.role), value.port);
    publishSnapshot(value.sessionId);
    if (value.role === 'receiver' || value.role === 'comparison') {
      void coordinator.retryRole(value.sessionId, value.role);
    }
  }
});
async function waitForRoles(sessionId, roles, timeoutMs = 35000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (roles.every(role => rolePorts.has(roleKey(sessionId, role)))) return true;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return false;
}

async function launchFromStudio(message) {
  const sessionId = String(message.sessionId || '').trim();
  const comparisonProvider = String(message.comparisonProvider || '').trim();
  const roles = ['sender','receiver', ...(comparisonProvider ? ['comparison'] : [])];
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
  const rolesReady = await waitForRoles(sessionId, roles);
  const bootText = String(message.bootText || '').trim();
  let boot = null;
  if (rolesReady && bootText) {
    boot = await coordinator.dispatchBoot({ sessionId, text:bootText });
  }
  const ok = rolesReady && launchIsReady({ roles, hasBoot:Boolean(bootText), boot });
  return {
    ok, sessionId, launch, boot, roles,
    error:ok ? '' : (rolesReady ? 'boot_not_rendered' : 'provider_not_ready')
  };
}

function controlSender(sessionId, command, payload = {}) {
  const port = rolePorts.get(roleKey(sessionId, 'sender'));
  if (!port) return false;
  port.postMessage({ type:'control', command, ...payload });
  return true;
}
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'pmia-simple') return;
  router.attach(port);

  port.onMessage.addListener(message => {
    if (message?.type === 'turn' && message.turn) {
      recordStage({ sessionId:message.turn.sessionId, role:'system', turnId:message.turn.turnId, stage:'fanout' });
      return;
    }
    if (message?.type === 'ui_register') {
      const sessionId = String(message.sessionId || '').trim();
      uiPorts.set(port, { sessionId, client:String(message.client || 'ui') });
      port.postMessage({ type:'snapshot', snapshot:publishSnapshot(sessionId) });
      return;
    }
    if (message?.type === 'get_snapshot') {
      port.postMessage({ type:'snapshot', snapshot:publishSnapshot(String(message.sessionId || '')) });
      return;
    }
    if (message?.type === 'control') {
      const ok = controlSender(String(message.sessionId || ''), String(message.command || ''), message);
      port.postMessage({ type:'control_result', requestId:message.requestId || '', ok });
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
    for (const [key, value] of rolePorts) {
      if (value === port) rolePorts.delete(key);
    }
    if (ui?.sessionId) publishSnapshot(ui.sessionId);
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
