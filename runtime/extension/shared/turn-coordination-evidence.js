const EVENT_TYPES = new Set([
  'source_interruption_detected',
  'source_interruption_recovery_required',
  'source_interruption_resolved',
  'forwarding_paused',
  'forwarding_resumed',
  'forwarding_resumed_without_send'
]);

function text(value, max = 128) {
  return String(value || '').trim().slice(0, max);
}

function ids(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => text(value, 160))
    .filter(Boolean))].slice(0, 128);
}

function number(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

function recommendedCommand(interruption = {}) {
  const state = text(interruption.state, 40);
  if (state === 'recovery_required') return 'retry_carryover';
  if (['detected', 'stop_pending', 'stop_requested', 'carryover_pending'].includes(state)) {
    return 'keep_accumulating';
  }
  return '';
}
function bookmarkFor(snapshot = {}, chainId = '') {
  const timeline = Array.isArray(snapshot.timeline) ? snapshot.timeline : [];
  const match = [...timeline].reverse().find(item => {
    const type = text(item?.type, 96);
    if (!EVENT_TYPES.has(type)) return false;
    if (!chainId) return true;
    return text(item?.data?.chainId, 160) === chainId;
  });
  if (!match) return null;
  return {
    id: text(match.id, 160),
    at: number(match.at),
    type: text(match.type, 96),
    chainId: text(match.data?.chainId || chainId, 160)
  };
}

export function deriveTurnCoordinationEvidence(snapshot = {}) {
  const coordination = snapshot?.batchState?.turnCoordination || {};
  const interruption = coordination.interruption || {};
  const memberIds = ids(interruption.memberIds);
  const chainId = text(interruption.chainId, 160);
  const command = recommendedCommand(interruption);
  return {
    format: 'pmia-turn-coordination-evidence-v1',
    mode: text(coordination.mode || 'live', 40),
    policy: text(coordination.policy || 'adaptive', 40),
    heldCount: Math.max(ids(coordination.heldMemberIds).length, number(coordination.heldCount)),
    heldMemberIds: ids(coordination.heldMemberIds),
    pausedAt: number(coordination.pausedAt),
    updatedAt: number(coordination.updatedAt),
    interruption: {
      state: text(interruption.state || 'none', 40),
      chainId,
      memberIds,
      activeBatchId: text(interruption.activeBatchId, 160),
      newBatchId: text(interruption.newBatchId || interruption.carryoverBatchId, 160),
      continuationId: text(interruption.continuationId, 160),
      preservedCount: Math.max(memberIds.length, number(interruption.preservedCount)),
      attempts: number(interruption.attempts),
      reason: text(interruption.reason, 96),
      failureReason: text(interruption.failureReason, 96),
      stopLatencyMs: number(interruption.stopLatencyMs),
      recoveryAction: text(interruption.recoveryAction || command, 64)
    },
    bookmark: bookmarkFor(snapshot, chainId),
    recommendedCommand: command
  };
}
