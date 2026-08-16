import { buildSessionSummary } from '../simple/session-summary.js';

const sessionId = new URLSearchParams(location.search).get('session') || '';
const port = chrome.runtime.connect({ name:'pmia-simple' });
const connection = document.getElementById('connection');
const path = document.getElementById('path');
const autoForward = document.getElementById('autoForward');
const pause = document.getElementById('pause');
const sendGathered = document.getElementById('sendGathered');
const exportButton = document.getElementById('export');
const help = document.getElementById('help');
const helpDialog = document.getElementById('helpDialog');
const closeHelp = document.getElementById('closeHelp');
let snapshot = { sessionId, roles:{}, stages:[] };
let automatic = true;
let paused = false;
let requestSeq = 0;

const label = stage => ({
  captured:'Captured', fanout:'Forwarding', composer_written:'Written',
  submitted:'Submitted', rendered:'Rendered', failed:'Failed'
}[stage] || 'Waiting');

function roleStatus(role, turnId) {
  if (role === 'comparison' && !snapshot.roles?.comparison) return 'Off';
  const stages = (snapshot.stages || []).filter(value => value.role === role && value.turnId === turnId);
  const value = stages.at(-1);
  if (!value) return snapshot.roles?.[role] ? 'Ready' : 'Disconnected';
  const elapsed = Number.isFinite(value.elapsedMs) ? ` · ${Math.round(value.elapsedMs)}ms` : '';
  const reason = value.reason ? ` · ${value.reason}` : '';
  return `${label(value.stage)}${elapsed}${reason}`;
}
function render() {
  const latest = [...(snapshot.stages || [])].reverse().find(value => value.turnId)?.turnId || '';
  const sender = path.querySelector('[data-role="sender"] em');
  const receiver = path.querySelector('[data-role="receiver"] em');
  const comparison = path.querySelector('[data-role="comparison"] em');
  sender.textContent = latest ? roleStatus('sender', latest) : (snapshot.roles?.sender ? 'Ready' : 'Disconnected');
  receiver.textContent = latest ? roleStatus('receiver', latest) : (snapshot.roles?.receiver ? 'Ready' : 'Disconnected');
  comparison.textContent = latest ? roleStatus('comparison', latest) : (snapshot.roles?.comparison ? 'Ready' : 'Off');
  autoForward.textContent = automatic ? 'Auto' : 'Gather';
  autoForward.classList.toggle('active', automatic);
  pause.textContent = paused ? 'Resume' : 'Pause';
  pause.classList.toggle('active', paused);
}

function control(command, payload = {}) {
  port.postMessage({
    type:'control', sessionId, command, requestId:`cockpit-${++requestSeq}`, ...payload
  });
}

autoForward.addEventListener('click', () => {
  automatic = !automatic;
  control('set_auto_forward', { enabled:automatic });
  render();
});

pause.addEventListener('click', () => {
  paused = !paused;
  control('set_paused', { enabled:paused });
  render();
});

sendGathered.addEventListener('click', () => control('send_gathered'));
function exportSession() {
  const payload = {
    exportedAt:new Date().toISOString(),
    summary:buildSessionSummary(snapshot),
    trace:snapshot
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `pmia-${sessionId}-session.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

exportButton.addEventListener('click', exportSession);
help.addEventListener('click', () => helpDialog.showModal());
closeHelp.addEventListener('click', () => helpDialog.close());

document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const key = String(event.key || '').toLowerCase();
  if (key === 'a') autoForward.click();
  else if (key === 'p') pause.click();
  else if (key === 'g') sendGathered.click();
  else if (key === 'e') exportSession();
  else if (key === 'h') helpDialog.open ? helpDialog.close() : helpDialog.showModal();
});

port.onMessage.addListener(message => {
  if (message?.type !== 'snapshot' || message.snapshot?.sessionId !== sessionId) return;
  snapshot = message.snapshot;
  connection.textContent = 'Connected';
  connection.classList.remove('off');
  render();
});

port.onDisconnect.addListener(() => {
  connection.textContent = 'Disconnected';
  connection.classList.add('off');
});

port.postMessage({ type:'ui_register', client:'cockpit', sessionId });
port.postMessage({ type:'get_snapshot', sessionId });
render();
