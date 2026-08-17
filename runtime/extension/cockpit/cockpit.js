import { buildSessionSummary } from '../simple/session-summary.js';
import { deriveReadiness } from '../simple/session-tools.js';
import { createResilientPort } from '../simple/live-port.js';
import { applyDisplayPreferences, formatElapsed, normalizeDisplayPreferences, speakingLabel } from './tools.js';

const sessionId = new URLSearchParams(location.search).get('session') || '';
const byId = id => document.getElementById(id);
const connection = byId('connection');
const path = byId('path');
const autoForward = byId('autoForward');
const pause = byId('pause');
const sendGathered = byId('sendGathered');
const exportButton = byId('export');
const helpDialog = byId('helpDialog');
const port = createResilientPort({
  connect:() => chrome.runtime.connect({ name:'pmia-simple' }),
  onReconnect:raw => {
    connection.textContent = 'Reconnecting';
    raw.postMessage({ type:'ui_register', client:'cockpit', sessionId });
    raw.postMessage({ type:'get_snapshot', sessionId });
  }
});
const pending = new Map();
let snapshot = { sessionId, roles:{}, stages:[], meta:null };
let review = null;
let automatic = true;
let paused = false;
let requestSeq = 0;
let selectedTurnId = '';
let cockpitBounds = null;
let display = normalizeDisplayPreferences(JSON.parse(sessionStorage.getItem('pmia_display') || 'null'));

const stageLabel = stage => ({ captured:'Captured', fanout:'Forwarding', composer_written:'Written', submitted:'Submitted', rendered:'Rendered', failed:'Failed' }[stage] || 'Waiting');
const roleName = role => ({ sender:'Window 1', receiver:'Window 2', comparison:'Window 3', cockpit:'Cockpit' }[role] || role);

function control(command, payload = {}) {
  port.postMessage({ type:'control', sessionId, command, requestId:`control-${++requestSeq}`, ...payload });
}

function requestUi(command, payload = {}, timeoutMs = 3000) {
  const requestId = `ui-${++requestSeq}`;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve({ ok:false, reason:'unavailable' });
    }, timeoutMs);
    pending.set(requestId, value => {
      clearTimeout(timer);
      pending.delete(requestId);
      resolve(value);
    });
    port.postMessage({ type:'ui_command', sessionId, command, requestId, ...payload });
  });
}

function roleStatus(role, turnId) {
  if (role === 'comparison' && !snapshot.meta?.roles?.comparison) return 'Off';
  const stages = (snapshot.stages || []).filter(value => value.role === role && value.turnId === turnId);
  const value = stages.at(-1);
  if (!value) return snapshot.roles?.[role] ? 'Ready' : 'Disconnected';
  const elapsed = Number.isFinite(value.elapsedMs) ? ` · ${Math.round(value.elapsedMs)}ms` : '';
  return `${stageLabel(value.stage)}${elapsed}${value.reason ? ` · ${value.reason}` : ''}`;
}

function renderStatus() {
  const ready = deriveReadiness({ meta:snapshot.meta || {}, snapshot });
  connection.textContent = ready.label;
  connection.classList.toggle('off', ready.state !== 'ready');
  byId('readiness').textContent = ready.label;
  byId('statusDetail').textContent = ready.detail;
  const latest = [...(snapshot.stages || [])].reverse().find(value => value.turnId)?.turnId || '';
  for (const role of ['sender','receiver','comparison']) {
    const node = path.querySelector(`[data-role="${role}"] em`);
    if (node) node.textContent = latest ? roleStatus(role, latest) : roleStatus(role, '');
  }
  autoForward.textContent = automatic ? 'Auto' : 'Gather';
  autoForward.classList.toggle('active', automatic);
  pause.textContent = paused ? 'Resume' : 'Pause';
  pause.classList.toggle('active', paused);
  byId('focusComparison').disabled = !snapshot.meta?.roles?.comparison;
}

function renderClock() {
  const startedAt = Number(snapshot.meta?.startedAt || 0);
  byId('sessionClock').textContent = startedAt ? formatElapsed(Date.now() - startedAt) : '00:00';
}

function renderStages(stages = snapshot.stages || []) {
  const node = byId('recentStages');
  node.replaceChildren();
  for (const value of stages.slice(-20).reverse()) {
    const row = document.createElement('div');
    row.textContent = `${roleName(value.role)} · ${stageLabel(value.stage)}${value.reason ? ` · ${value.reason}` : ''}`;
    node.append(row);
  }
}

function selectQuestion(turnId, text) {
  selectedTurnId = turnId;
  byId('selectedQuestion').textContent = text || turnId || 'Select a recent question first.';
  for (const id of ['markStrong','markReview','markFollowUp']) byId(id).disabled = !selectedTurnId;
}

function renderQuestions(values = []) {
  const node = byId('recentQuestions');
  node.replaceChildren();
  for (const value of values.slice(-20).reverse()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'question-row';
    button.textContent = value.text;
    button.title = value.text;
    button.addEventListener('click', () => selectQuestion(value.id, value.text));
    node.append(button);
  }
  if (!values.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No recent questions available.';
    node.append(empty);
  }
}

function renderReview(data) {
  review = data || null;
  const inspection = data?.inspection || {};
  const receiver = speakingLabel(inspection.receiver?.metrics);
  const comparison = snapshot.meta?.roles?.comparison ? speakingLabel(inspection.comparison?.metrics) : 'Off';
  byId('answerMetrics').textContent = `Window 2: ${receiver} · Window 3: ${comparison}`;
  renderQuestions(inspection.sender?.recentQuestions || []);
  renderStages(data?.snapshot?.stages || snapshot.stages || []);
}

async function refreshReview() {
  byId('reviewRefresh').disabled = true;
  const result = await requestUi('get_review_data', {}, 5000);
  byId('reviewRefresh').disabled = false;
  if (!result?.ok || !result.data) {
    byId('answerMetrics').textContent = 'Review data unavailable.';
    return null;
  }
  renderReview(result.data);
  return result.data;
}

async function markSelected(category) {
  if (!selectedTurnId) return;
  const result = await requestUi('mark_question', { turnId:selectedTurnId, category });
  byId('selectedQuestion').textContent = result?.ok ? `Marked ${category.replaceAll('_',' ')}` : 'Marker unavailable.';
  if (result?.ok) await refreshReview();
}

async function copyLatestQuestion() {
  const data = review || await refreshReview();
  const latest = data?.inspection?.sender?.recentQuestions?.at(-1);
  if (!latest?.text) {
    byId('selectedQuestion').textContent = 'No recent question to copy.';
    return;
  }
  await navigator.clipboard.writeText(latest.text);
  byId('selectedQuestion').textContent = 'Latest question copied.';
}

function saveDisplay() {
  display = applyDisplayPreferences(document.documentElement, {
    largeText:byId('fontSize').checked,
    highContrast:byId('highContrast').checked,
    reducedMotion:byId('reducedMotion').checked
  });
  sessionStorage.setItem('pmia_display', JSON.stringify(display));
}

async function openTools() {
  const current = await chrome.windows.getCurrent().catch(() => null);
  if (current) {
    cockpitBounds = { left:current.left, top:current.top, width:current.width, height:current.height };
    if (current.height < 560) {
      await chrome.windows.update(current.id, { top:Math.max(0, current.top - 440), height:560 }).catch(() => null);
    }
  }
  helpDialog.showModal();
}

async function closeTools() {
  helpDialog.close();
  const current = await chrome.windows.getCurrent().catch(() => null);
  if (current && cockpitBounds) await chrome.windows.update(current.id, cockpitBounds).catch(() => null);
  cockpitBounds = null;
}


function downloadJson(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `pmia-${sessionId}-session.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function exportSession() {
  const result = await requestUi('get_review_data', {}, 5000);
  const data = result?.ok ? result.data : null;
  const readiness = deriveReadiness({ meta:snapshot.meta || {}, snapshot });
  const inspection = data?.inspection || {};
  downloadJson({
    exportedAt:new Date().toISOString(),
    version:snapshot.version || '0.12.0',
    route:snapshot.meta?.roles || {},
    readiness,
    summary:data?.summary || buildSessionSummary(snapshot),
    answerMetrics:{ receiver:inspection.receiver?.metrics || null, comparison:inspection.comparison?.metrics || null },
    markers:data?.markers || [],
    inspectionAvailable:Boolean(data),
    trace:snapshot
  });
}

function resetEndChoices() {
  for (const id of ['exportBeforeEnd','cancelEnd','endAnyway']) byId(id).hidden = true;
}

async function prepareEnd() {
  const result = await requestUi('get_end_state');
  const count = Math.max(0, Number(result?.unresolvedCount || 0));
  if (count) {
    byId('endState').textContent = `${count} unresolved delivery item${count === 1 ? '' : 's'}. Export, cancel, or end anyway.`;
    for (const id of ['exportBeforeEnd','cancelEnd','endAnyway']) byId(id).hidden = false;
    return;
  }
  if (confirm('End this PMIA session and close only its managed windows?')) await requestUi('end_session');
}
autoForward.addEventListener('click', () => {
  automatic = !automatic;
  control('set_auto_forward', { enabled:automatic });
  renderStatus();
});
pause.addEventListener('click', () => {
  paused = !paused;
  control('set_paused', { enabled:paused });
  renderStatus();
});
sendGathered.addEventListener('click', () => control('send_gathered'));
exportButton.addEventListener('click', () => void exportSession());
byId('help').addEventListener('click', () => void openTools());
byId('closeHelp').addEventListener('click', () => void closeTools());

for (const [id, role] of [['focusSender','sender'],['focusReceiver','receiver'],['focusComparison','comparison'],['focusCockpit','cockpit']]) {
  byId(id).addEventListener('click', () => void requestUi('focus_window', { role }));
}
byId('restoreLayout').addEventListener('click', () => void requestUi('restore_layout'));
byId('reviewRefresh').addEventListener('click', () => void refreshReview());
byId('copyLatest').addEventListener('click', () => void copyLatestQuestion());
byId('markStrong').addEventListener('click', () => void markSelected('strong_answer'));
byId('markReview').addEventListener('click', () => void markSelected('needs_review'));
byId('markFollowUp').addEventListener('click', () => void markSelected('follow_up'));
for (const id of ['fontSize','highContrast','reducedMotion']) byId(id).addEventListener('change', saveDisplay);
byId('endSession').addEventListener('click', () => void prepareEnd());
byId('endAnyway').addEventListener('click', () => void requestUi('end_session', { force:true }));
byId('exportBeforeEnd').addEventListener('click', () => void exportSession());
byId('cancelEnd').addEventListener('click', () => {
  resetEndChoices();
  byId('endState').textContent = 'End cancelled.';
});
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
  const key = String(event.key || '').toLowerCase();
  if (key === 'a') autoForward.click();
  else if (key === 'p') pause.click();
  else if (key === 'g') sendGathered.click();
  else if (key === 'e') void exportSession();
  else if (key === 'h') helpDialog.open ? void closeTools() : void openTools();
});

port.onMessage.addListener(message => {
  if (message?.type === 'ui_result' && pending.has(message.requestId)) {
    pending.get(message.requestId)(message.result || { ok:false, reason:'empty_result' });
    return;
  }
  if (message?.type !== 'snapshot' || message.snapshot?.sessionId !== sessionId) return;
  snapshot = message.snapshot;
  renderStatus();
  renderClock();
});

port.onDisconnect.addListener(() => {
  connection.textContent = 'Disconnected';
  connection.classList.add('off');
  for (const resolve of pending.values()) resolve({ ok:false, reason:'disconnected' });
  pending.clear();
});
byId('fontSize').checked = display.largeText;
byId('highContrast').checked = display.highContrast;
byId('reducedMotion').checked = display.reducedMotion;
applyDisplayPreferences(document.documentElement, display);
setInterval(renderClock, 1000);
port.postMessage({ type:'ui_register', client:'cockpit', sessionId });
port.postMessage({ type:'get_snapshot', sessionId });
renderStatus();
renderClock();