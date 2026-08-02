function capability(role = {}) {
  const adapter = role.adapterCapabilities || {};
  const probation = role.adapterCapabilityProbation || {};
  const drift = role.adapterCapabilityDrift || {};
  return { provider: String(role.provider || ''), complete: Boolean(adapter.complete), required: Array.isArray(adapter.required) ? [...adapter.required] : [], missing: Array.isArray(adapter.missingRequired) ? [...adapter.missingRequired] : [], writeSafe: probation.writeSafe !== false, probation: String(probation.state || 'unknown'), drift: String(drift.state || 'unknown'), removed: Array.isArray(drift.removed) ? [...drift.removed] : [] };
}
export function deriveProviderRouteReadiness(snapshot = {}) {
  const sender = capability(snapshot.sender); const receiver = capability(snapshot.receiver);
  const blockers = [];
  if (!sender.provider || !receiver.provider) blockers.push('provider_missing');
  if (!sender.complete) blockers.push('sender_capability_incomplete');
  if (!receiver.complete) blockers.push('receiver_capability_incomplete');
  if (!receiver.writeSafe) blockers.push('receiver_write_unsafe');
  if (!snapshot.contextArmed) blockers.push('context_not_armed');
  if (snapshot.deliveryPolicy?.active) blockers.push('queue_only_active');
  const ready = blockers.length === 0;
  const checklist = [
    { id: 'roles', ok: Boolean(sender.provider && receiver.provider), label: 'Both provider roles registered' },
    { id: 'capabilities', ok: sender.complete && receiver.complete, label: 'Required adapter capabilities complete' },
    { id: 'write', ok: receiver.writeSafe, label: 'Receiver provider writes safe' },
    { id: 'context', ok: Boolean(snapshot.contextArmed), label: 'Session context armed' },
    { id: 'delivery', ok: !snapshot.deliveryPolicy?.active, label: 'Provider delivery enabled' }
  ];
  return { state: ready ? 'ready' : 'blocked', ready, blockers, sender, receiver, route: `${sender.provider || '--'} -> ${receiver.provider || '--'}`, checklist, resendEligible: Boolean(snapshot.sender?.connected && snapshot.receiver?.connected), recommendedCommand: !snapshot.contextArmed ? 'resend_context' : 'check_live' };
}
