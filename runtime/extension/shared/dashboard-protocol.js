const COMMANDS = new Set([
  'pause',
  'resume_catch_up',
  'submit_selected',
  'resume_without_send',
  'set_auto_submit',
  'set_hold',
  'submit_now',
  'interrupt_latest',
  'resolve_draft_keep_manual',
  'resolve_draft_restore_pmia',
  'resolve_draft_merge',
  'archive_selected',
  'archive_all',
  'archive_proven',
  'check_live',
  'run_self_test',
  'repair_runtime',
  'resend_context',
  'toggle_mic',
  'toggle_scroll',
  'focus_composer',
  'export_session',
  'prepare_end_session',
  'end_session',
  'layout_both',
  'layout_sender',
  'layout_receiver',
  'layout_dashboard',
  'hide_managed',
  'restore_managed'
]);

export const DASHBOARD_PORT_PREFIX = 'pmia-dashboard:';
export const DASHBOARD_COMMANDS = COMMANDS;

function cleanText(value, max = 160) {
  const text = String(value || '').trim();
  return text && text.length <= max ? text : '';
}

export function dashboardPortName(sessionId) {
  const normalized = cleanText(sessionId, 128);
  if (!normalized) throw new TypeError('Invalid PMIA dashboard session');
  return `${DASHBOARD_PORT_PREFIX}${normalized}`;
}

export function parseDashboardPortName(name) {
  const value = String(name || '');
  if (!value.startsWith(DASHBOARD_PORT_PREFIX)) return '';
  return cleanText(value.slice(DASHBOARD_PORT_PREFIX.length), 128);
}

export function normalizeDashboardCommand(value) {
  if (!value || typeof value !== 'object') return null;
  const sessionId = cleanText(value.sessionId, 128);
  const requestId = cleanText(value.requestId, 128);
  const command = cleanText(value.command, 64).toLowerCase();
  if (!sessionId || !requestId || !COMMANDS.has(command)) return null;

  const payload = value.payload && typeof value.payload === 'object'
    ? { ...value.payload }
    : {};
  if (['submit_selected', 'archive_selected'].includes(command)) {
    const queueItemId = cleanText(payload.queueItemId, 160);
    if (!queueItemId) return null;
    payload.queueItemId = queueItemId;
  }
  if (['set_auto_submit', 'set_hold'].includes(command)) {
    payload.value = Boolean(payload.value);
  }
  if (command === 'end_session') {
    payload.confirmToken = cleanText(payload.confirmToken, 160);
    payload.mode = ['clean', 'archive_and_end'].includes(payload.mode) ? payload.mode : 'clean';
  }
  return { sessionId, requestId, command, payload };
}
