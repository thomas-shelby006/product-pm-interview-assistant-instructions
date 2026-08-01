export function normalizeSessionCheckpoint(value = {}) {
  return {
    id: String(value.id || ''),
    createdAt: Math.max(0, Number(value.createdAt || 0)),
    phase: String(value.phase || 'setup'),
    mode: String(value.mode || 'active'),
    activeBatchId: String(value.activeBatchId || ''),
    activeMemberIds: Array.isArray(value.activeMemberIds) ? value.activeMemberIds.map(String).slice(0, 64) : [],
    nextBatchId: String(value.nextBatchId || ''),
    nextMemberIds: Array.isArray(value.nextMemberIds) ? value.nextMemberIds.map(String).slice(0, 128) : [],
    clock: {
      startedAt: Math.max(0, Number(value.clock?.startedAt || 0)),
      pausedAt: Math.max(0, Number(value.clock?.pausedAt || 0)),
      pausedTotalMs: Math.max(0, Number(value.clock?.pausedTotalMs || 0)),
      segmentId: String(value.clock?.segmentId || '')
    },
    attentionCode: String(value.attentionCode || ''),
    unresolvedCount: Math.max(0, Number(value.unresolvedCount || 0)),
    reason: String(value.reason || '').slice(0, 80)
  };
}

export function deriveSessionCheckpoint(snapshot = {}, now = Date.now(), reason = 'semantic_commit') {
  const active = snapshot.batchState?.active || null;
  const next = snapshot.batchState?.next || null;
  const live = snapshot.liveSession || {};
  const unresolvedCount = (snapshot.ledger || []).filter(item => !['proven', 'archived'].includes(item.state)).length;
  return normalizeSessionCheckpoint({
    id: `cp-${String(snapshot.sessionId || 'session')}-${Math.max(0, Number(now))}`,
    createdAt: now,
    phase: live.phase || 'setup',
    mode: snapshot.mode || 'active',
    activeBatchId: active?.id || active?.batchId || '',
    activeMemberIds: active?.memberIds || active?.prompt?.memberIds || [],
    nextBatchId: next?.id || next?.batchId || '',
    nextMemberIds: next?.memberIds || next?.entries?.map(item => item.id) || [],
    clock: {
      startedAt: live.startedAt || 0,
      pausedAt: live.pausedAt || 0,
      pausedTotalMs: live.pausedTotalMs || 0,
      segmentId: live.segmentId || ''
    },
    attentionCode: snapshot.rootCause?.code || snapshot.liveOperations?.attention?.reason || '',
    unresolvedCount,
    reason
  });
}
