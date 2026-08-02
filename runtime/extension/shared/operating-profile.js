export const OPERATING_PROFILES = Object.freeze({
  safe: Object.freeze({ id: 'safe', label: 'Safe', autoSubmit: false, hold: true, receiverPolicy: { pauseAfterAnswer: true, submitOnIdle: false, drainMode: 'off' }, description: 'Operator confirms every release boundary.' }),
  balanced: Object.freeze({ id: 'balanced', label: 'Balanced', autoSubmit: true, hold: false, receiverPolicy: { pauseAfterAnswer: false, submitOnIdle: true, drainMode: 'off' }, description: 'Automatic delivery with explicit no-response and conflict gates.' }),
  fast: Object.freeze({ id: 'fast', label: 'Fast', autoSubmit: true, hold: false, receiverPolicy: { pauseAfterAnswer: false, submitOnIdle: true, drainMode: 'all' }, description: 'Drain protected batches aggressively after verified answer boundaries.' })
});
export function normalizeOperatingProfile(value) { return OPERATING_PROFILES[String(value || '').toLowerCase()] ? String(value).toLowerCase() : 'balanced'; }
export function operatingProfileEligibility(snapshot = {}, requested = 'balanced') {
  const profile = normalizeOperatingProfile(requested);
  const blockers = [];
  if (profile === 'fast') {
    if (['high','critical'].includes(snapshot.storagePressure?.level)) blockers.push('storage_pressure');
    if (snapshot.deliveryPolicy?.active) blockers.push('queue_only_active');
    if (snapshot.stateAudit?.blocked || snapshot.stateCompatibility?.state === 'blocked') blockers.push('state_incompatible');
    if (snapshot.receiver?.adapterCapabilityProbation?.writeSafe === false) blockers.push('provider_write_unsafe');
    if (snapshot.selfTest?.ok !== true) blockers.push('self_test_required');
  }
  return { allowed: blockers.length === 0, blockers, profile };
}
export function deriveOperatingProfile(snapshot = {}, requested = snapshot.productionControls?.operatingProfile || 'balanced') {
  const id = normalizeOperatingProfile(requested);
  const value = OPERATING_PROFILES[id];
  const current = snapshot.batchState || {};
  const eligibility = operatingProfileEligibility(snapshot, id);
  const changes = [
    ['autoSubmit', current.autoSubmit !== value.autoSubmit, current.autoSubmit, value.autoSubmit],
    ['hold', Boolean(current.hold) !== value.hold, Boolean(current.hold), value.hold],
    ['pauseAfterAnswer', Boolean(current.receiverPolicy?.pauseAfterAnswer) !== value.receiverPolicy.pauseAfterAnswer, Boolean(current.receiverPolicy?.pauseAfterAnswer), value.receiverPolicy.pauseAfterAnswer],
    ['submitOnIdle', Boolean(current.receiverPolicy?.submitOnIdle) !== value.receiverPolicy.submitOnIdle, Boolean(current.receiverPolicy?.submitOnIdle), value.receiverPolicy.submitOnIdle],
    ['drainMode', String(current.receiverPolicy?.drainMode || 'off') !== value.receiverPolicy.drainMode, String(current.receiverPolicy?.drainMode || 'off'), value.receiverPolicy.drainMode]
  ].filter(([,changed]) => changed).map(([field,,from,to]) => ({ field, from, to }));
  return { ...value, eligibility, changes, selected: snapshot.productionControls?.operatingProfile === id };
}
