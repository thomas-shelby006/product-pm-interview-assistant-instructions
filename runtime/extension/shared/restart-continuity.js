export function buildRestartContinuity(snapshot = {}, now = Date.now()) {
  return {
    sessionId: String(snapshot.sessionId || ''),
    schemaVersion: Math.max(1, Number(snapshot.stateCompatibility?.schemaVersion || 1)),
    generation: Math.max(0, Number(snapshot.transportSession?.generation || snapshot.registryGeneration || 0)),
    phase: String(snapshot.liveSession?.phase || 'setup'),
    checkpointAt: Math.max(0, Number(snapshot.checkpoint?.at || 0)),
    ledgerCounts: { ...(snapshot.ledgerCounts || {}) },
    outboxCount: Math.max(0, Number(snapshot.senderOutboxState?.count || 0)),
    gap: snapshot.sequenceGap ? { missingSeq: Number(snapshot.sequenceGap.missingSeq || 0), bufferedCount: Number(snapshot.sequenceGap.bufferedCount || 0) } : null,
    recovery: snapshot.recoverySchedule ? { ...snapshot.recoverySchedule } : null,
    capturedAt: now
  };
}

export function evaluateRestartContinuity(before = {}, after = {}) {
  const issues = [];
  if (before.sessionId !== after.sessionId) issues.push('session_identity_changed');
  if (Number(after.generation || 0) < Number(before.generation || 0)) issues.push('generation_regressed');
  if (Number(after.ledgerCounts?.unresolved || after.ledgerCounts?.pending || 0) < Number(before.ledgerCounts?.unresolved || before.ledgerCounts?.pending || 0) - Number(after.ledgerCounts?.proven || 0)) issues.push('unresolved_count_regressed');
  if (Number(after.outboxCount || 0) > Number(before.outboxCount || 0) && !after.gap) issues.push('outbox_growth_unexplained');
  return { ok: issues.length === 0, issues, before: { ...before }, after: { ...after } };
}
