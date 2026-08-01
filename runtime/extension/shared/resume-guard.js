export function deriveResumeGuard(snapshot = {}) {
  const blockers = [];
  if (!snapshot || snapshot.mode === 'ended' || snapshot.endedAt) blockers.push('session_ended');
  if (snapshot.storagePressure?.level === 'critical') blockers.push('storage_critical');
  if (snapshot.deliveryPolicy?.allowPersist === false) blockers.push('persistence_blocked');
  if (snapshot.sequenceGap?.blocked || snapshot.sequenceGap?.missingSeq) blockers.push('sequence_gap');
  if (snapshot.senderOutboxState?.ready === false) blockers.push('sender_outbox_unavailable');
  if (['unresolved','keep_manual'].includes(String(snapshot.batchState?.draftConflict?.state || ''))) blockers.push('draft_conflict');
  if (snapshot.selfTest?.trust?.state === 'failed') blockers.push('self_test_failed');
  return {
    allowed: blockers.length === 0,
    blockers,
    action: blockers.length ? (blockers.includes('draft_conflict') ? 'resolve_draft_restore_pmia' : 'check_live') : 'resume_checkpoint',
    phase: String(snapshot.liveSession?.phase || 'setup'),
    retainedFinals: Math.max(0, Number(snapshot.ledgerCounts?.pending || 0) + Number(snapshot.ledgerCounts?.inFlight || 0))
  };
}

export function validateResumeBoundary(snapshot = {}, requestedPhase = 'active') {
  const guard = deriveResumeGuard(snapshot);
  if (!guard.allowed) return { ok: false, error: 'resume_blocked', ...guard };
  if (!['active','paused','debrief'].includes(String(requestedPhase))) return { ok: false, error: 'invalid_resume_phase', ...guard };
  return { ok: true, phase: requestedPhase, ...guard };
}
