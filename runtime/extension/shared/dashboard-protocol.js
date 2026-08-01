const COMMANDS = new Set([
  'pause',
  'start_mock',
  'set_session_phase',
  'mark_interviewer_activity',
  'set_focus_mode',
  'acknowledge_incident',
  'snooze_incident',
  'clear_incident',
  'set_quiet_mode',
  'resume_catch_up',
  'set_question_pin',
  'defer_question',
  'set_question_priority',
  'link_question_follow_up',
  'undo_question_action',
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
  'reset_recovery_budget',
  'run_transport_drill',
  'resend_context',
  'toggle_mic',
  'toggle_scroll',
  'focus_composer',
  'export_session',
  'export_support_bundle',
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
  if (['set_question_pin', 'defer_question', 'set_question_priority', 'link_question_follow_up'].includes(command)) {
    payload.itemId = cleanText(payload.itemId, 160);
    if (!payload.itemId) return null;
  }
  if (command === 'set_question_pin') payload.value = Boolean(payload.value);
  if (command === 'defer_question') {
    payload.condition = ['none', 'after_current_answer', 'manual', 'until_time'].includes(payload.condition) ? payload.condition : 'manual';
    payload.until = Math.max(0, Number(payload.until || 0));
  }
  if (command === 'set_question_priority') {
    payload.priority = ['low', 'normal', 'high', 'critical'].includes(payload.priority) ? payload.priority : 'normal';
  }
  if (command === 'link_question_follow_up') payload.parentId = cleanText(payload.parentId, 160);
  if (command === 'undo_question_action') {
    payload.undoId = cleanText(payload.undoId, 200);
    if (!payload.undoId) return null;
  }
  if (['acknowledge_incident', 'snooze_incident', 'clear_incident'].includes(command)) {
    payload.incidentId = cleanText(payload.incidentId, 200);
    if (!payload.incidentId) return null;
  }
  if (command === 'snooze_incident') {
    payload.durationMs = Math.max(60_000, Math.min(3_600_000, Number(payload.durationMs) || 300_000));
  }
  if (['set_auto_submit', 'set_hold', 'set_focus_mode', 'set_quiet_mode'].includes(command)) {
    payload.value = Boolean(payload.value);
  }
  if (command === 'set_session_phase') {
    payload.phase = cleanText(payload.phase, 24).toLowerCase();
    if (!['setup','ready','active','paused','debrief','ended'].includes(payload.phase)) return null;
    payload.reason = cleanText(payload.reason, 80) || 'operator';
  }
  if (command === 'start_mock') {
    payload.plannedDurationMs = Math.max(0, Math.min(14_400_000, Number(payload.plannedDurationMs) || 0));
  }
  if (command === 'export_support_bundle') {
    for (const key of Object.keys(payload)) delete payload[key];
  }
  if (command === 'end_session') {
    payload.confirmToken = cleanText(payload.confirmToken, 160);
    payload.mode = ['clean', 'archive_and_end'].includes(payload.mode) ? payload.mode : 'clean';
  }
  return { sessionId, requestId, command, payload };
}
