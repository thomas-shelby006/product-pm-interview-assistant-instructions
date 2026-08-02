import { canonicalFingerprint } from './canonical-fingerprint.js';
import { deriveOperatingProfile } from './operating-profile.js';
import { deriveContainmentStatus } from './containment-status.js';

const TTL_MS = 30_000;

function protectedCount(snapshot = {}) {
  const counts = snapshot.ledgerCounts || {};
  if (Number.isFinite(Number(counts.unresolved))) return Math.max(0, Number(counts.unresolved));
  return Math.max(0, Number(counts.pending || 0)) + Math.max(0, Number(counts.inFlight || 0));
}

export function policySnapshotFingerprint(snapshot = {}) {
  return canonicalFingerprint({
    sessionId:snapshot.sessionId || '', mode:snapshot.mode || '', protectedCount:protectedCount(snapshot),
    batch:{ autoSubmit:snapshot.batchState?.autoSubmit !== false, hold:Boolean(snapshot.batchState?.hold), receiverPolicy:snapshot.batchState?.receiverPolicy || {} },
    deliveryPolicy:{ active:Boolean(snapshot.deliveryPolicy?.active), reason:snapshot.deliveryPolicy?.reason || '', allowProviderWrite:snapshot.deliveryPolicy?.allowProviderWrite !== false },
    storage:snapshot.storagePressure?.level || 'normal', selfTest:Boolean(snapshot.selfTest?.ok),
    writeSafe:snapshot.receiver?.adapterCapabilityProbation?.writeSafe !== false,
    productionControls:{
      operatingProfile:String(snapshot.productionControls?.operatingProfile || 'balanced'),
      containmentOverrideUntil:Math.max(0,Number(snapshot.productionControls?.containmentOverrideUntil || 0))
    }
  });
}

export function buildPolicyImpactPreview(snapshot = {}, request = {}, now = Date.now()) {
  const kind = String(request.kind || '');
  const fingerprint = policySnapshotFingerprint(snapshot);
  const count = protectedCount(snapshot);
  if (kind === 'operating_profile') {
    const profile = deriveOperatingProfile(snapshot, request.profile);
    const startsWrites = profile.changes.some(item => item.field === 'hold' && item.to === false)
      || profile.changes.some(item => item.field === 'autoSubmit' && item.to === true);
    const stopsWrites = profile.changes.some(item => item.field === 'hold' && item.to === true)
      || profile.changes.some(item => item.field === 'autoSubmit' && item.to === false);
    return { id:`policy:${kind}:${profile.id}:${fingerprint}`, kind, target:profile.id, fingerprint, createdAt:now, expiresAt:now+TTL_MS,
      allowed:profile.eligibility.allowed, blockers:[...profile.eligibility.blockers], protectedCount:count,
      providerWrites:startsWrites ? 'may_start' : stopsWrites ? 'will_stop' : 'unchanged',
      postAnswer:profile.receiverPolicy.pauseAfterAnswer ? 'pause' : profile.receiverPolicy.drainMode === 'all' ? 'drain_all' : profile.receiverPolicy.submitOnIdle ? 'submit_on_idle' : 'unchanged',
      reversible:true, risk:profile.id === 'fast' || startsWrites ? 'caution' : 'safe', changes:profile.changes.map(item=>({...item})) };
  }
  if (kind === 'containment_override') {
    const status = deriveContainmentStatus(snapshot, now);
    const enabled = Boolean(request.enabled);
    const allowed = !enabled || status.overrideEligible;
    return { id:`policy:${kind}:${enabled ? 'enable' : 'disable'}:${fingerprint}`, kind, target:enabled ? 'enable' : 'disable', fingerprint, createdAt:now, expiresAt:now+TTL_MS,
      allowed, blockers:allowed ? [] : [status.hard ? 'hard_containment' : 'override_ineligible'], protectedCount:count,
      providerWrites:enabled ? 'may_start' : 'will_stop', postAnswer:'unchanged', reversible:true, risk:enabled ? 'caution' : 'safe',
      changes:[{ field:'containmentOverride', from:Boolean(status.overrideActive), to:enabled }] };
  }
  return { id:'', kind, target:'', fingerprint, createdAt:now, expiresAt:now, allowed:false, blockers:['unsupported_policy'], protectedCount:count, providerWrites:'unchanged', postAnswer:'unchanged', reversible:false, risk:'safe', changes:[] };
}

export function validatePolicyImpactConfirmation(snapshot = {}, preview = {}, now = Date.now()) {
  if (!preview?.id) return { ok:false, error:'policy_preview_missing' };
  if (now > Number(preview.expiresAt || 0)) return { ok:false, error:'policy_preview_expired' };
  if (policySnapshotFingerprint(snapshot) !== String(preview.fingerprint || '')) return { ok:false, error:'policy_preview_stale' };
  const rebuilt=buildPolicyImpactPreview(snapshot,{ kind:preview.kind, profile:preview.target, enabled:preview.target === 'enable' },Number(preview.createdAt || now));
  if (!rebuilt.allowed) return { ok:false, error:'policy_preview_blocked', blockers:rebuilt.blockers };
  if (rebuilt.id !== preview.id || rebuilt.protectedCount !== preview.protectedCount) return { ok:false, error:'policy_preview_changed' };
  return { ok:true, preview:rebuilt };
}