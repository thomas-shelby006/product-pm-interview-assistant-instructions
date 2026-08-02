const HARD_REASONS = new Set(['session_storage_critical','runtime_state_blocked','state_incompatible','state_quarantined','registration_missing']);
export function deriveContainmentStatus(snapshot = {}, now = Date.now()) {
  const policy = snapshot.deliveryPolicy || {};
  const overrideUntil = Math.max(0, Number(snapshot.productionControls?.containmentOverrideUntil || 0));
  const overrideActive = overrideUntil > now;
  const hard = HARD_REASONS.has(String(policy.reason || '')) || snapshot.mode === 'blocked';
  const state = snapshot.mode === 'blocked' ? 'blocked' : policy.active ? 'queue_only' : (snapshot.rootCause?.severity === 'warn' ? 'watch' : 'normal');
  return { state, reason: String(policy.reason || snapshot.rootCause?.code || 'healthy'), protected: policy.active, overrideActive, overrideUntil, overrideEligible: policy.active && !hard, hard, recommendedCommand: hard ? 'repair_runtime' : policy.active ? 'check_live' : '', evaluatedAt: now };
}
export function applyContainmentOverride(policy = {}, snapshot = {}, now = Date.now()) {
  const status = deriveContainmentStatus({ ...snapshot, deliveryPolicy: policy }, now);
  if (!status.overrideActive || !status.overrideEligible) return { ...policy, overridden: false };
  return { ...policy, active: false, allowProviderWrite: true, reason: `override:${policy.reason || 'operator'}`, resumeWhen: 'override_expiry', overridden: true, overrideUntil: status.overrideUntil };
}
