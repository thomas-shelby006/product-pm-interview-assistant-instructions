const COMMAND_IDS = Object.freeze([
  'pause','start_mock','run_preflight','set_session_phase','mark_interviewer_activity','set_focus_mode',
  'set_shortcut_binding','reset_shortcut_bindings','set_accessibility_preference','acknowledge_incident',
  'snooze_incident','clear_incident','set_quiet_mode','add_marker','remove_marker','resume_checkpoint',
  'resume_live_session','dismiss_crash_resume','resume_catch_up','set_question_pin','defer_question',
  'set_question_priority','link_question_follow_up','undo_question_action','submit_selected','resume_without_send',
  'set_auto_submit','set_hold','set_receiver_policy','submit_now','interrupt_latest','acknowledge_answer','resolve_operator_choice',
  'resolve_no_response','preview_interrupt_latest','resolve_draft_keep_manual','resolve_draft_restore_pmia',
  'resolve_draft_merge','archive_selected','archive_all','archive_proven','compact_proven','retry_outbox',
  'check_live','run_self_test','repair_runtime','repair_live_metadata','apply_operating_profile',
  'set_containment_override','probe_transport','record_production_navigation','start_stabilization',
  'run_stabilization_step','cancel_stabilization','reset_recovery_budget','run_transport_drill','resend_context',
  'toggle_mic','toggle_scroll','focus_composer','export_session','export_support_bundle','prepare_end_session',
  'end_session','focus_sender','focus_receiver','focus_pilot','focus_back','spotlight_sender','spotlight_receiver',
  'spotlight_pilot','layout_both','layout_sender','layout_receiver','layout_dashboard','hide_managed','restore_managed',
  'record_session_navigator_visit'
]);

const GROUPS = Object.freeze({
  pause:'Delivery', resume_catch_up:'Delivery', resume_without_send:'Delivery', submit_selected:'Delivery',
  submit_now:'Delivery', interrupt_latest:'Delivery', set_auto_submit:'Delivery', set_hold:'Delivery',
  set_receiver_policy:'Delivery', retry_outbox:'Delivery', compact_proven:'Storage', archive_selected:'Review',
  archive_all:'Review', archive_proven:'Review', export_session:'Review', export_support_bundle:'Review',
  check_live:'Recovery', run_self_test:'Recovery', repair_runtime:'Recovery', repair_live_metadata:'Recovery',
  start_stabilization:'Recovery', run_stabilization_step:'Recovery', cancel_stabilization:'Recovery',
  reset_recovery_budget:'Recovery', run_transport_drill:'Verification', probe_transport:'Verification',
  focus_sender:'Navigate', focus_receiver:'Navigate', focus_pilot:'Navigate', focus_back:'Navigate',
  spotlight_sender:'Navigate', spotlight_receiver:'Navigate', spotlight_pilot:'Navigate', focus_composer:'Navigate',
  layout_both:'Layout', layout_sender:'Layout', layout_receiver:'Layout', layout_dashboard:'Layout',
  hide_managed:'Layout', restore_managed:'Layout', prepare_end_session:'Session', end_session:'Session'
});
const RISK = Object.freeze({
  interrupt_latest:'destructive', end_session:'destructive', archive_all:'caution', compact_proven:'caution',
  repair_runtime:'caution', set_containment_override:'caution', apply_operating_profile:'caution',
  submit_now:'caution', submit_selected:'caution', resolve_draft_restore_pmia:'caution', resolve_draft_merge:'caution'
});

const CONFIRMATION = Object.freeze({
  interrupt_latest:'preview_token', end_session:'prepared_token', set_containment_override:'policy_preview',
  apply_operating_profile:'policy_preview', archive_all:'explicit', compact_proven:'explicit'
});

const MODE = Object.freeze({
  preview_interrupt_latest:'inspect', record_production_navigation:'inspect'
});

const LABELS = Object.freeze({
  pause:'Pause forwarding', resume_catch_up:'Resume and catch up', submit_now:'Submit next batch now',
  interrupt_latest:'Interrupt for latest question', check_live:'Check live health', run_self_test:'Run active self-test',
  repair_runtime:'Repair runtime', run_transport_drill:'Run transport drill', compact_proven:'Compact proven history',
  retry_outbox:'Retry sender outbox', export_support_bundle:'Download support bundle',
  prepare_end_session:'Prepare end session', end_session:'End session'
});

function humanize(value) {
  return String(value || '').split('_').filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function definition(id) {
  return Object.freeze({
    id,
    label: LABELS[id] || humanize(id),
    group: GROUPS[id] || 'Operations',
    risk: RISK[id] || 'safe',
    mode: MODE[id] || 'execute',
    owner: 'runtime_pilot_controller',
    payload: id,
    confirmation: CONFIRMATION[id] || 'none',
    navigation: ''
  });
}

export const COMMAND_REGISTRY = Object.freeze(COMMAND_IDS.map(definition));
const BY_ID = new Map(COMMAND_REGISTRY.map(item => [item.id, item]));

export function registeredCommandIds() {
  return COMMAND_REGISTRY.map(item => item.id);
}

export function commandDefinition(id) {
  return BY_ID.get(String(id || '').toLowerCase()) || null;
}

export function normalizeRegisteredCommand(value) {
  const id = String(value || '').trim().toLowerCase();
  return BY_ID.has(id) ? id : '';
}

export function commandRegistryDigestSource() {
  return COMMAND_REGISTRY.map(item => [item.id,item.group,item.risk,item.mode,item.owner,item.confirmation].join(':')).join('|');
}

export function auditCommandRegistry(registry = COMMAND_REGISTRY) {
  const errors = [];
  const seen = new Set();
  const risks = new Set(['safe','caution','destructive']);
  const modes = new Set(['execute','choose','inspect']);
  for (const item of registry) {
    if (!item?.id || seen.has(item.id)) errors.push({ code:'duplicate_or_missing_id', id:String(item?.id || '') });
    seen.add(item?.id);
    if (!risks.has(item?.risk)) errors.push({ code:'invalid_risk', id:item?.id });
    if (!modes.has(item?.mode)) errors.push({ code:'invalid_mode', id:item?.id });
    if (!item?.owner) errors.push({ code:'missing_owner', id:item?.id });
  }
  return { ok: errors.length === 0, count: registry.length, errors };
}