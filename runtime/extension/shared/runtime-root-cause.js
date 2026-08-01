const PRECEDENCE = ['state_compatibility','storage_critical','registration_missing','transport_unavailable','provider_capability_blocked','sequence_gap','batch_conflict','proof_failed'];

function cause(owner = 'runtime', code = 'healthy', severity = 'info', evidence = {}, nextAction = '') {
  return { owner, code, severity, evidence, nextAction, suppressed: [] };
}

export function classifyRuntimeRootCause(snapshot, now = Date.now()) {
  if (!snapshot) return cause('runtime', 'snapshot_missing', 'error', {}, 'check_live');
  const candidates = [];
  if (snapshot.stateCompatibility?.state === 'blocked' || snapshot.stateAudit?.blocked) {
    candidates.push(cause('state', 'state_compatibility', 'error', { state: snapshot.stateCompatibility?.state || 'blocked' }, 'recover_state'));
  }
  if (snapshot.storagePressure?.level === 'critical') {
    candidates.push(cause('storage', 'storage_critical', 'error', { percent: Number(snapshot.storagePressure.percent || 0) }, 'compact_proven'));
  }
  for (const role of ['sender', 'receiver']) {
    const value = snapshot[role] || {};
    if (!value.connected || ['missing', 'unresponsive'].includes(String(value.phase || ''))) {
      candidates.push(cause('registration', 'registration_missing', 'error', { role, phase: value.phase || 'missing' }, 'repair_runtime'));
    }
    const lane = value.transportLane || {};
    if (lane.state === 'open' || lane.lastMode === 'fallback_only') {
      candidates.push(cause('transport', 'transport_unavailable', 'error', { role, state: lane.state || '', mode: lane.lastMode || '' }, 'repair_runtime'));
    }
    const probation = value.adapterCapabilityProbation || {};
    if (probation.writeSafe === false) {
      candidates.push(cause('provider', 'provider_capability_blocked', 'error', { role, reason: probation.reason || '' }, 'check_live'));
    }
  }
  const gap = [...(snapshot.timeline || [])].reverse().find(event => ['sequence_gap','sequence_gap_cleared'].includes(event.type));
  if (gap?.type === 'sequence_gap') candidates.push(cause('sequence', 'sequence_gap', 'error', { ...gap.data }, 'resume_catch_up'));
  if (['unresolved','keep_manual'].includes(snapshot.batchState?.draftConflict?.state)) {
    candidates.push(cause('batch', 'batch_conflict', 'warn', { state: snapshot.batchState.draftConflict.state }, 'resolve_draft_restore_pmia'));
  }
  if (snapshot.latestProof?.ok === false || snapshot.latestProof?.verified === false) {
    candidates.push(cause('proof', 'proof_failed', 'error', { reason: snapshot.latestProof?.reason || 'unverified' }, 'check_live'));
  }
  if (!candidates.length) return cause('runtime', 'healthy', 'info', { evaluatedAt: Number(now) || Date.now() }, '');
  const rank = code => Math.max(0, PRECEDENCE.indexOf(code));
  candidates.sort((a, b) => rank(a.code) - rank(b.code));
  const primary = candidates[0];
  primary.suppressed = candidates.slice(1).map(item => ({ owner: item.owner, code: item.code, severity: item.severity }));
  return primary;
}
