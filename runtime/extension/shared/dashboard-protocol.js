import { registeredCommandIds, normalizeRegisteredCommand } from './operator-command-registry.js';

const COMMANDS = new Set(registeredCommandIds());

export const DASHBOARD_PORT_PREFIX = 'pmia-dashboard:';
export const DASHBOARD_COMMANDS = COMMANDS;

function cleanText(value, max = 160) {
  const text = String(value || '').trim();
  return text && text.length <= max ? text : '';
}

function normalizePolicyPreview(value) {
  if (!value || typeof value !== 'object') return null;
  const kind = ['operating_profile','containment_override'].includes(String(value.kind || '')) ? String(value.kind) : '';
  const id = cleanText(value.id, 500);
  const fingerprint = cleanText(value.fingerprint, 500);
  const target = cleanText(value.target, 40);
  if (!kind || !id || !fingerprint || !target) return null;
  return { id, kind, target, fingerprint, createdAt:Math.max(0,Number(value.createdAt || 0)), expiresAt:Math.max(0,Number(value.expiresAt || 0)), protectedCount:Math.max(0,Number(value.protectedCount || 0)) };
}

const STRICT_PAYLOAD_KEYS = Object.freeze({
  end_session:['confirmToken','mode'], apply_operating_profile:['profile','preview'], set_containment_override:['enabled','durationMs','reason','preview'],
  resolve_operator_choice:['choiceId','fingerprint','option'], resolve_no_response:['action'], interrupt_latest:['token'],
  export_support_bundle:[], set_session_phase:['phase','reason'], start_mock:['plannedDurationMs']
});
function pruneStrictPayload(command,payload){ const keys=STRICT_PAYLOAD_KEYS[command]; if(!keys) return payload; return Object.fromEntries(keys.filter(key=>key in payload).map(key=>[key,payload[key]])); }

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
  const command = normalizeRegisteredCommand(cleanText(value.command, 64));
  if (!sessionId || !requestId || !command || !COMMANDS.has(command)) return null;

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
  if (command === 'set_shortcut_binding') {
    payload.commandId = cleanText(payload.commandId, 80);
    payload.chord = cleanText(payload.chord, 80);
    if (!payload.commandId || !payload.chord) return null;
  }
  if (command === 'set_accessibility_preference') {
    payload.name = cleanText(payload.name, 40);
    payload.value = cleanText(payload.value, 40);
    if (!['reducedMotion','textScale','contrast'].includes(payload.name)) return null;
  }
  if (command === 'add_marker') {
    payload.category = cleanText(payload.category, 40);
    payload.targetType = cleanText(payload.targetType, 24);
    payload.targetId = cleanText(payload.targetId, 160);
    if (!['follow_up','strong_answer','weak_answer','needs_review','metric_gap','execution_gap'].includes(payload.category)) return null;
    if (!['trace','envelope','batch','session'].includes(payload.targetType)) return null;
  }
  if (command === 'remove_marker') {
    payload.markerId = cleanText(payload.markerId, 200);
    if (!payload.markerId) return null;
  }
  if (['focus_sender','focus_receiver','focus_pilot','focus_back','spotlight_sender','spotlight_receiver','spotlight_pilot'].includes(command)) {
    const value = payload.focusIntent;
    if (!value || typeof value !== 'object') return null;
    payload.focusIntent = {
      id: cleanText(value.id, 160),
      sessionId: cleanText(value.sessionId, 160),
      target: cleanText(value.target, 32),
      action: cleanText(value.action, 48),
      issuedAt: Math.max(0, Number(value.issuedAt || 0)),
      expiresAt: Math.max(0, Number(value.expiresAt || 0))
    };
    if (!payload.focusIntent.id) return null;
  }
  if (['set_auto_submit', 'set_hold', 'set_focus_mode', 'set_quiet_mode'].includes(command)) {
    payload.value = Boolean(payload.value);
  }
  if (command === 'set_receiver_policy') {
    payload.policy = payload.policy && typeof payload.policy === 'object' ? { ...payload.policy } : {};
    if ('pauseAfterAnswer' in payload.policy) payload.policy.pauseAfterAnswer = Boolean(payload.policy.pauseAfterAnswer);
    if ('submitOnIdle' in payload.policy) payload.policy.submitOnIdle = Boolean(payload.policy.submitOnIdle);
    if ('drainMode' in payload.policy) payload.policy.drainMode = ['off', 'one', 'all'].includes(payload.policy.drainMode) ? payload.policy.drainMode : 'off';
  }
  if (command === 'interrupt_latest') payload.token = cleanText(payload.token, 160);
  if (command === 'resolve_operator_choice') {
    const choiceId = cleanText(payload.choiceId, 200);
    const fingerprint = cleanText(payload.fingerprint, 500);
    const option = cleanText(payload.option, 80);
    if (!choiceId || !fingerprint || !option) return null;
    for (const key of Object.keys(payload)) delete payload[key];
    Object.assign(payload, { choiceId, fingerprint, option });
  }
  if (command === 'resolve_no_response') payload.action = ['wait', 'retry', 'continue'].includes(payload.action) ? payload.action : 'wait';
  if (command === 'apply_operating_profile') {
    const profile = ['safe','balanced','fast'].includes(String(payload.profile || '')) ? String(payload.profile) : '';
    const preview = normalizePolicyPreview(payload.preview);
    if (!profile || !preview) return null;
    for (const key of Object.keys(payload)) delete payload[key];
    Object.assign(payload, { profile, preview });
  }
  if (command === 'set_containment_override') {
    const enabled = Boolean(payload.enabled);
    const durationMs = Math.max(0, Math.min(15 * 60_000, Number(payload.durationMs) || 120_000));
    const reason = cleanText(payload.reason, 80) || 'operator';
    const preview = normalizePolicyPreview(payload.preview);
    if (!preview) return null;
    for (const key of Object.keys(payload)) delete payload[key];
    Object.assign(payload, { enabled, durationMs, reason, preview });
  }
  if (command === 'save_navigator_workspace') {
    const workspace = payload.workspace && typeof payload.workspace === 'object' ? payload.workspace : {};
    payload.workspace = { id: cleanText(workspace.id, 120), label: cleanText(workspace.label, 160), visiblePanels: Array.isArray(workspace.visiblePanels) ? workspace.visiblePanels.map(value => cleanText(value, 60)).filter(Boolean).slice(0, 20) : [], filters: workspace.filters && typeof workspace.filters === 'object' ? { ...workspace.filters } : {}, focus: cleanText(workspace.focus, 60) || 'now' };
    if (!payload.workspace.id || !payload.workspace.label) return null;
  }
  if (command === 'add_navigator_bookmark') {
    const bookmark = payload.bookmark && typeof payload.bookmark === 'object' ? payload.bookmark : {};
    payload.bookmark = { id: cleanText(bookmark.id, 160), targetType: cleanText(bookmark.targetType, 40), targetId: cleanText(bookmark.targetId, 160), category: cleanText(bookmark.category, 40) || 'evidence', label: cleanText(bookmark.label, 160) };
    if (!payload.bookmark.targetType || !payload.bookmark.targetId) return null;
  }
  if (command === 'remove_navigator_bookmark') { payload.bookmarkId = cleanText(payload.bookmarkId, 160); if (!payload.bookmarkId) return null; }
  if (command === 'set_navigator_goal') {
    const goal = payload.goal && typeof payload.goal === 'object' ? payload.goal : {};
    payload.goal = { id: cleanText(goal.id, 120), label: cleanText(goal.label, 160), targetCount: Math.max(1, Math.min(50, Number(goal.targetCount || 1))), priority: ['low','normal','high','critical'].includes(String(goal.priority)) ? String(goal.priority) : 'normal', phases: Array.isArray(goal.phases) ? goal.phases.map(value => cleanText(value, 40)).filter(Boolean).slice(0, 6) : [] };
    if (!payload.goal.id || !payload.goal.label) return null;
  }
  if (command === 'tag_navigator_coverage') { payload.questionId = cleanText(payload.questionId, 160); payload.goalIds = Array.isArray(payload.goalIds) ? payload.goalIds.map(value => cleanText(value, 120)).filter(Boolean).slice(0, 32) : []; if (!payload.questionId) return null; }
  if (command === 'mark_navigator_scenario_complete') { payload.scenarioId = cleanText(payload.scenarioId, 120); if (!payload.scenarioId) return null; }
  if (command === 'record_session_navigator_visit') {
    const visit = payload.visit && typeof payload.visit === 'object' ? payload.visit : {};
    payload.visit = { id: cleanText(visit.id, 160), tab: cleanText(visit.tab, 40) || 'now', entityType: cleanText(visit.entityType, 40), entityId: cleanText(visit.entityId, 160), reason: cleanText(visit.reason, 80) || 'operator_navigation' };
  }
  if (command === 'record_production_navigation') {
    const route = payload.route && typeof payload.route === 'object' ? payload.route : {};
    payload.route = { view: cleanText(route.view, 40) || 'overview', anchor: cleanText(route.anchor, 100), reason: cleanText(route.reason, 120) || 'operator_navigation' };
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
    const confirmToken = cleanText(payload.confirmToken, 160);
    const mode = ['clean', 'archive_and_end'].includes(payload.mode) ? payload.mode : 'clean';
    for (const key of Object.keys(payload)) delete payload[key];
    Object.assign(payload, { confirmToken, mode });
  }
  return { sessionId, requestId, command, payload:pruneStrictPayload(command,payload) };
}
