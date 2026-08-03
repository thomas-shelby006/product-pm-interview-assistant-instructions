import { deriveAdaptiveTurnSafety } from './adaptive-turn-safety.js';

function capability(role = {}) {
  const adapter = role.adapterCapabilities || {};
  const probation = role.adapterCapabilityProbation || {};
  const drift = role.adapterCapabilityDrift || {};
  return {
    provider: String(role.provider || ''),
    connected: role.connected !== false,
    phase: String(role.phase || ''),
    composerReady: role.composerReady !== false,
    complete: Boolean(adapter.complete),
    required: Array.isArray(adapter.required) ? [...adapter.required] : [],
    missing: Array.isArray(adapter.missingRequired) ? [...adapter.missingRequired] : [],
    writeSafe: probation.writeSafe !== false,
    probation: String(probation.state || 'unknown'),
    drift: String(drift.state || 'unknown'),
    removed: Array.isArray(drift.removed) ? [...drift.removed] : []
  };
}

export function deriveProviderRouteReadiness(snapshot = {}) {
  const sender = capability(snapshot.sender);
  const receiver = capability(snapshot.receiver);
  const blockers = [];
  if (!sender.provider || !receiver.provider) blockers.push('provider_missing');
  if (!sender.connected || sender.phase === 'missing') blockers.push('sender_runtime_missing');
  if (!receiver.connected || receiver.phase === 'missing') blockers.push('receiver_runtime_missing');
  if (!sender.complete) blockers.push('sender_capability_incomplete');
  if (!receiver.complete) blockers.push('receiver_capability_incomplete');
  if (!receiver.composerReady) blockers.push('receiver_composer_not_ready');
  if (!receiver.writeSafe) blockers.push('receiver_write_unsafe');
  if (!snapshot.contextArmed) blockers.push('context_not_armed');
  if (snapshot.selfTest && snapshot.selfTest.ok !== true) blockers.push('self_test_not_ready');
  if (snapshot.deliveryPolicy?.active) blockers.push('queue_only_active');
  if (snapshot.routeTransition?.state === 'freeze_required') blockers.push('route_transition_frozen');
  const adaptiveSafety = deriveAdaptiveTurnSafety(snapshot);
  if (adaptiveSafety.blocksRouteChange) blockers.push('adaptive_turns_actionable');
  const uniqueBlockers = [...new Set(blockers)];
  const ready = uniqueBlockers.length === 0;
  const checklist = [
    { id: 'roles', ok: Boolean(sender.provider && receiver.provider && sender.connected && receiver.connected), label: 'Both provider roles registered' },
    { id: 'capabilities', ok: sender.complete && receiver.complete, label: 'Required adapter capabilities complete' },
    { id: 'composer', ok: receiver.composerReady, label: 'Receiver composer ready' },
    { id: 'write', ok: receiver.writeSafe, label: 'Receiver provider writes safe' },
    { id: 'context', ok: Boolean(snapshot.contextArmed), label: 'Session context armed' },
    { id: 'delivery', ok: !snapshot.deliveryPolicy?.active, label: 'Provider delivery enabled' },
    { id: 'coordination', ok: !adaptiveSafety.blocksRouteChange, label: 'Adaptive turns resolved' }
  ];
  const recommendedCommand = uniqueBlockers.includes('adaptive_turns_actionable')
    ? adaptiveSafety.recommendedCommand || 'check_live'
    : uniqueBlockers.includes('context_not_armed')
      ? 'resend_context'
      : uniqueBlockers.some(value => value.includes('runtime_missing'))
        ? 'repair_runtime'
        : uniqueBlockers.includes('receiver_write_unsafe') || uniqueBlockers.includes('self_test_not_ready')
          ? 'run_self_test'
          : 'check_live';
  return {
    state: ready ? 'ready' : 'blocked',
    ready,
    blockers: uniqueBlockers,
    sender,
    receiver,
    adaptiveSafety,
    route: `${sender.provider || '--'} -> ${receiver.provider || '--'}`,
    checklist,
    resendEligible: Boolean(sender.connected && receiver.connected),
    recommendedCommand
  };
}
