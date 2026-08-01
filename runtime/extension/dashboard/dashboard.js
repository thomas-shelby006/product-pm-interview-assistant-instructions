import {
  actionableQueue,
  buildDiagnostics,
  deriveReview,
  formatDuration,
  latestReceiverProof,
  primaryTransportAction,
  roleHealth,
  virtualSlice,
  warningLabel
} from './dashboard-model.js';

const params = new URLSearchParams(location.search);
const sessionId = String(params.get('session') || '').trim();
const state = {
  snapshot: null,
  port: null,
  reconnectAttempt: 0,
  reconnectTimer: null,
  selectedQueueId: '',
  queueFilter: 'actionable',
  timelineFilter: 'all',
  activeView: 'overview',
  pending: new Map()
};

const byId = id => document.getElementById(id);
const connectionState = byId('connectionState');
const toast = byId('toast');
const timelineViewport = byId('timelineViewport');
const timelineCanvas = byId('timelineCanvas');

function setConnection(label, tone = 'warn') {
  connectionState.dataset.tone = tone;
  connectionState.querySelector('span:last-child').textContent = label;
}

function showToast(message, tone = 'info') {
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sendCommand(command, payload = {}) {
  if (!state.port) {
    showToast('Dashboard is not connected.', 'error');
    return Promise.resolve({ ok: false, error: 'dashboard_disconnected' });
  }
  const id = requestId();
  const promise = new Promise(resolve => {
    state.pending.set(id, resolve);
    setTimeout(() => {
      if (!state.pending.has(id)) return;
      state.pending.delete(id);
      resolve({ ok: false, error: 'command_timeout' });
    }, 12000);
  });
  state.port.postMessage({
    sessionId,
    requestId: id,
    command,
    payload
  });
  return promise;
}

function connect() {
  clearTimeout(state.reconnectTimer);
  if (!sessionId) {
    setConnection('Missing session', 'error');
    document.body.dataset.fatal = 'true';
    return;
  }
  document.title = `PMIA_DASHBOARD_${sessionId.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`;
  setConnection('Connecting', 'warn');
  try {
    const port = chrome.runtime.connect({ name: `pmia-dashboard:${sessionId}` });
    state.port = port;
    port.onMessage.addListener(handlePortMessage);
    port.onDisconnect.addListener(() => {
      state.port = null;
      failPendingCommands();
      setConnection('Reconnecting', 'warn');
      scheduleReconnect();
    });
  } catch {
    scheduleReconnect();
  }
}

function failPendingCommands(reason = 'dashboard_disconnected') {
  for (const resolve of state.pending.values()) {
    resolve({ ok: false, error: reason });
  }
  state.pending.clear();
}

function scheduleReconnect() {
  state.reconnectAttempt += 1;
  const delay = Math.min(8000, 350 * (2 ** Math.min(5, state.reconnectAttempt)));
  clearTimeout(state.reconnectTimer);
  state.reconnectTimer = setTimeout(connect, delay);
}

function handlePortMessage(message) {
  if (message?.type === 'PMIA_DASHBOARD_SNAPSHOT') {
    state.reconnectAttempt = 0;
    state.snapshot = message.snapshot;
    setConnection('Live', 'ok');
    render();
    return;
  }
  if (message?.type === 'PMIA_DASHBOARD_SESSION_ENDED') {
    state.snapshot = null;
    setConnection('Session ended', 'error');
    render();
    return;
  }
  if (message?.type === 'PMIA_DASHBOARD_COMMAND_RESULT') {
    const resolve = state.pending.get(message.requestId);
    if (!resolve) return;
    state.pending.delete(message.requestId);
    resolve(message.result || { ok: false, error: 'empty_command_result' });
  }
}

function text(id, value) {
  const node = byId(id);
  if (node) node.textContent = value;
}

function yesNo(value) {
  return value ? 'Yes' : 'No';
}

function renderRole(roleName, role, now) {
  const health = roleHealth(role, now);
  const prefix = roleName;
  const healthNode = byId(`${prefix}Health`);
  healthNode.textContent = health.label;
  healthNode.dataset.tone = health.tone;
  text(`${prefix}Provider`, role?.provider || 'â€”');
  text(`${prefix}Phase`, role?.phase || 'â€”');
  text(`${prefix}Composer`, role?.composerReady ? 'Ready' : 'Waiting');
  text(`${prefix}Heartbeat`, health.ageMs === null ? 'â€”' : `${formatDuration(health.ageMs)} ago`);
  const capabilities = role?.adapterCapabilities;
  text(`${prefix}Adapter`, !capabilities
    ? 'Unknown'
    : capabilities.complete
      ? 'Complete'
      : `Missing: ${(capabilities.missingRequired || []).join(', ')}`);
  if (roleName === 'sender') {
    text('senderVoice', role?.voiceActive ? 'Active' : 'Idle');
    text('senderSilence', role?.sourceSilenceMs ? formatDuration(role.sourceSilenceMs) : '0s');
  } else {
    text('receiverGenerating', role?.generating ? 'Generating' : 'Idle');
    text('receiverScroll', role?.scrollLocked ? 'Locked' : 'Free');
  }
}

function renderWarnings(snapshot) {
  const container = byId('warningList');
  container.replaceChildren();
  const warnings = [...(snapshot?.warnings || [])];
  if (!warnings.length) {
    const item = document.createElement('p');
    item.className = 'empty';
    item.textContent = 'All runtime markers are healthy.';
    container.append(item);
    text('healthScore', 'Healthy');
    return;
  }
  for (const warning of warnings) {
    const item = document.createElement('div');
    item.className = `warning-item ${warning.severity === 'error' ? 'error' : ''}`;
    item.textContent = warningLabel(warning);
    container.append(item);
  }
  const errors = warnings.filter(item => item.severity === 'error').length;
  text('healthScore', errors ? `${errors} critical` : `${warnings.length} attention`);
}

function renderOverview(snapshot, now) {
  text('sessionId', snapshot?.sessionId || sessionId || 'â€”');
  text('route', snapshot ? `${snapshot.sender?.provider || '?'} â†’ ${snapshot.receiver?.provider || '?'}` : 'â€”');
  text('transportMode', snapshot?.mode || 'â€”');
  text('uptime', snapshot ? formatDuration(now - snapshot.createdAt) : 'â€”');
  renderRole('sender', snapshot?.sender, now);
  renderRole('receiver', snapshot?.receiver, now);
  renderWarnings(snapshot);
  text('deliverySuccess', snapshot ? `${snapshot.metrics?.deliverySuccessRate ?? 100}%` : 'â€”');
  text('averageProof', snapshot ? formatDuration(snapshot.metrics?.averageDeliveryProofMs || 0) : 'â€”');
  text('queuedFinals', String(snapshot?.queue?.length || 0));
  text('answerTimeouts', String(snapshot?.metrics?.answerTimeouts || 0));
  text('latestPreview', snapshot?.latestPreview?.text || 'No preview observed.');
  text('latestFinal', snapshot?.latestFinal?.text || 'No final observed.');
  text('latestAnswer', snapshot?.receiver?.latestAnswer?.text || snapshot?.latestAnswer?.text || 'No answer captured.');
  const proof = snapshot?.latestProof || latestReceiverProof(snapshot?.timeline)?.data || null;
  text('latestProof', proof
    ? (proof.ok
      ? `${proof.proof || 'rendered_turn'} Â· ${proof.verified === false ? 'unverified' : 'verified'} Â· ${proof.envelopeId || ''}`
      : `${proof.reason || 'proof_failed'} Â· ${proof.envelopeId || ''}`)
    : 'No receiver proof recorded.');
  const activeQueue = actionableQueue(snapshot?.queue, false);
  text('queueBadge', String(activeQueue.length));
  const primary = primaryTransportAction(snapshot?.mode);
  const primaryButton = byId('primaryTransportAction');
  primaryButton.dataset.command = primary.command;
  primaryButton.textContent = primary.label;
}

function renderQueue(snapshot, now) {
  const body = byId('queueBody');
  body.replaceChildren();
  const queue = actionableQueue(snapshot?.queue, state.queueFilter === 'all');
  if (!queue.length) {
    state.selectedQueueId = '';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'empty';
    cell.textContent = 'Queue is empty.';
    row.append(cell);
    body.append(row);
    return;
  }
  if (!queue.some(item => item.id === state.selectedQueueId)) {
    state.selectedQueueId = queue.at(-1)?.id || '';
  }
  for (const item of queue) {
    const row = document.createElement('tr');
    if (item.id === state.selectedQueueId) row.classList.add('selected');
    if (item.status === 'superseded') row.classList.add('superseded');
    row.addEventListener('click', () => {
      state.selectedQueueId = item.id;
      renderQueue(state.snapshot, Date.now());
    });
    const selectCell = document.createElement('td');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'queueItem';
    radio.checked = item.id === state.selectedQueueId;
    radio.setAttribute('aria-label', `Select queue item ${item.envelope?.seq || ''}`);
    selectCell.append(radio);
    const age = document.createElement('td');
    age.textContent = formatDuration(now - item.queuedAt);
    const seq = document.createElement('td');
    seq.textContent = String(item.envelope?.seq || 0);
    const status = document.createElement('td');
    status.textContent = item.status || 'queued';
    const question = document.createElement('td');
    question.className = 'question';
    question.textContent = item.envelope?.text || '';
    row.append(selectCell, age, seq, status, question);
    body.append(row);
  }
}

function eventCategory(type) {
  const value = String(type || '');
  if (/answer/.test(value)) return 'answer';
  if (/health|heartbeat|registration|live_check|warning|role_/.test(value)) return 'health';
  if (/command|layout|repair|dashboard|scroll|mic|mute|pause|resume/.test(value)) return 'control';
  return 'transport';
}

function eventSummary(event) {
  const data = event?.data || {};
  const parts = [];
  for (const key of ['role', 'command', 'reason', 'envelopeId', 'queueItemId', 'mode']) {
    if (data[key] !== undefined && data[key] !== '') parts.push(`${key}: ${data[key]}`);
  }
  if (data.ok !== undefined) parts.push(`ok: ${data.ok}`);
  return parts.join(' Â· ') || 'State updated';
}

function filteredTimeline(snapshot) {
  const events = snapshot?.timeline || [];
  if (state.timelineFilter === 'all') return events;
  return events.filter(event => eventCategory(event.type) === state.timelineFilter);
}

function renderTimeline(snapshot) {
  const events = filteredTimeline(snapshot);
  const slice = virtualSlice(events, timelineViewport.scrollTop, timelineViewport.clientHeight, 52, 6);
  timelineCanvas.style.height = `${Math.max(slice.totalHeight, timelineViewport.clientHeight)}px`;
  timelineCanvas.replaceChildren();
  slice.items.forEach((event, offset) => {
    const row = document.createElement('div');
    row.className = 'timeline-row';
    row.style.top = `${(slice.start + offset) * 52}px`;
    const time = document.createElement('time');
    time.textContent = new Date(event.at).toLocaleTimeString([], { hour12: false });
    const type = document.createElement('b');
    type.textContent = event.type;
    const summary = document.createElement('span');
    summary.textContent = eventSummary(event);
    row.append(time, type, summary);
    timelineCanvas.append(row);
  });
}

function reviewItem(label, value) {
  const item = document.createElement('div');
  item.className = 'review-item';
  const name = document.createElement('span');
  name.textContent = label;
  const result = document.createElement('strong');
  result.textContent = String(value ?? 'â€”');
  item.append(name, result);
  return item;
}

function renderReview(snapshot) {
  const review = deriveReview(snapshot);
  const grid = byId('reviewGrid');
  grid.replaceChildren(
    reviewItem('Company', review.context.company || 'Not provided'),
    reviewItem('Target role', review.context.targetRole || 'Not provided'),
    reviewItem('Round', review.context.interviewRound || 'Not provided'),
    reviewItem('Answer mode', review.context.answerMode || 'Not provided'),
    reviewItem('Questions observed', review.questions),
    reviewItem('Delivered', review.delivered),
    reviewItem('Delivery success', `${review.deliverySuccessRate}%`),
    reviewItem('Average proof', formatDuration(review.averageDeliveryProofMs)),
    reviewItem('Average answer', formatDuration(review.averageAnswerElapsedMs)),
    reviewItem('Answer timeouts', review.answerTimeouts)
  );
  byId('repairReport').textContent = snapshot?.lastRepair
    ? JSON.stringify(snapshot.lastRepair, null, 2)
    : 'No repair has been run.';
}

function render() {
  const now = Date.now();
  renderOverview(state.snapshot, now);
  renderQueue(state.snapshot, now);
  renderTimeline(state.snapshot);
  renderReview(state.snapshot);
}

async function runCommand(button, command, payload = {}) {
  const confirmation = button?.dataset?.confirm;
  if (confirmation && !globalThis.confirm(confirmation)) return;
  button?.setAttribute('disabled', '');
  const result = await sendCommand(command, payload);
  button?.removeAttribute('disabled');
  if (result?.ok) {
    showToast(command.replaceAll('_', ' '), 'ok');
  } else {
    showToast(result?.error || `${command} failed`, 'error');
  }
}

document.addEventListener('click', event => {
  const tab = event.target.closest('[data-view]');
  if (tab) {
    state.activeView = tab.dataset.view;
    document.querySelectorAll('[data-view]').forEach(node => node.classList.toggle('active', node === tab));
    document.querySelectorAll('[data-view-panel]').forEach(node => node.classList.toggle('active', node.dataset.viewPanel === state.activeView));
    render();
    return;
  }
  const button = event.target.closest('[data-command]');
  if (button) void runCommand(button, button.dataset.command);
});

byId('sendSelected').addEventListener('click', event => {
  if (!state.selectedQueueId) return showToast('Select a queued final.', 'warn');
  const item = state.snapshot?.queue?.find(candidate => candidate.id === state.selectedQueueId);
  if (item?.status === 'superseded') return showToast('Superseded finals cannot be sent.', 'warn');
  void runCommand(event.currentTarget, 'send_selected', { queueItemId: state.selectedQueueId });
});
byId('discardSelected').addEventListener('click', event => {
  if (!state.selectedQueueId) return showToast('Select a queued final.', 'warn');
  void runCommand(event.currentTarget, 'discard_selected', { queueItemId: state.selectedQueueId });
});
byId('discardSuperseded').addEventListener('click', event => {
  void runCommand(event.currentTarget, 'discard_superseded');
});
byId('discardAll').addEventListener('click', event => {
  event.currentTarget.dataset.confirm = 'Discard every queued final?';
  void runCommand(event.currentTarget, 'discard_all');
});
byId('queueFilter').addEventListener('change', event => {
  state.queueFilter = event.target.value;
  renderQueue(state.snapshot, Date.now());
});
byId('timelineFilter').addEventListener('change', event => {
  state.timelineFilter = event.target.value;
  timelineViewport.scrollTop = 0;
  renderTimeline(state.snapshot);
});
timelineViewport.addEventListener('scroll', () => renderTimeline(state.snapshot), { passive: true });
byId('copyDiagnostics').addEventListener('click', async () => {
  const diagnostics = JSON.stringify(buildDiagnostics(state.snapshot), null, 2);
  try {
    await navigator.clipboard.writeText(diagnostics);
    showToast('Safe diagnostics copied.', 'ok');
  } catch {
    showToast('Clipboard write failed.', 'error');
  }
});

document.addEventListener('keydown', event => {
  if (event.target.matches('input,select,textarea')) return;
  const key = event.key.toLowerCase();
  if (key === ' ') {
    event.preventDefault();
    void sendCommand(state.snapshot?.mode === 'paused' ? 'resume_without_send' : 'pause');
  } else if (key === 'l') void sendCommand('resume_latest');
  else if (key === 'h') void sendCommand('check_live');
  else if (key === 'r') void sendCommand('repair_runtime');
  else if (key === 'e') void sendCommand('export_session');
  else if (key === 'm') void sendCommand('toggle_mic');
  else if (key === 's') void sendCommand('toggle_scroll');
  else if (key === 'd') byId('copyDiagnostics').click();
});

setInterval(() => {
  if (state.snapshot) render();
}, 1000);

connect();
render();
