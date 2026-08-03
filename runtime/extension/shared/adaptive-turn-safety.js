const ACTIONABLE_MODES = new Set(['paused_accumulating', 'resume_pending', 'submitting']);
const ACTIONABLE_INTERRUPTION_STATES = new Set([
  'detected',
  'stop_pending',
  'stop_requested',
  'carryover_pending',
  'recovery_required'
]);

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

function coordinationFrom(value = {}) {
  if (value?.batchState?.turnCoordination) return value.batchState.turnCoordination;
  if (value?.turnCoordination) return value.turnCoordination;
  return value && typeof value === 'object' ? value : {};
}

export function deriveAdaptiveTurnSafety(value = {}) {
  const coordination = coordinationFrom(value);
  const mode = String(coordination.mode || 'live');
  const interruption = coordination.interruption && typeof coordination.interruption === 'object'
    ? coordination.interruption
    : {};
  const interruptionState = String(interruption.state || 'none');
  const heldMemberIds = uniqueStrings(
    coordination.heldMemberIds
    || value?.batchState?.next?.memberIds
    || value?.next?.memberIds
    || []
  );
  const heldCount = Math.max(
    heldMemberIds.length,
    Math.max(0, Number(coordination.heldCount || 0)),
    Math.max(0, Number(value?.batchState?.next?.protectedCount || value?.batchState?.next?.questionCount || 0))
  );
  const interruptionMemberIds = uniqueStrings(interruption.memberIds);
  const interruptionCount = Math.max(
    interruptionMemberIds.length,
    ACTIONABLE_INTERRUPTION_STATES.has(interruptionState) ? 1 : 0
  );
  const blockers = [];
  if (ACTIONABLE_MODES.has(mode)) blockers.push(`coordination_${mode}`);
  if (heldCount > 0 && mode !== 'live') blockers.push('held_questions_present');
  if (ACTIONABLE_INTERRUPTION_STATES.has(interruptionState)) blockers.push(`interruption_${interruptionState}`);
  const actionable = blockers.length > 0;
  const actionableCount = actionable ? Math.max(1, heldCount, interruptionCount) : 0;
  const recommendedCommand = mode === 'paused_accumulating' || mode === 'resume_pending'
    ? 'resume_catch_up'
    : ACTIONABLE_INTERRUPTION_STATES.has(interruptionState)
      ? 'check_live'
      : '';
  return {
    actionable,
    actionableCount,
    safe: !actionable,
    mode,
    heldCount,
    heldMemberIds,
    interruptionState,
    interruptionCount,
    interruptionMemberIds,
    chainId: String(interruption.chainId || ''),
    blockers,
    blocksEnd: actionable,
    blocksExport: actionable,
    blocksRouteChange: actionable,
    primaryReason: blockers[0] || 'coordination_clear',
    reason: blockers[0] || 'coordination_clear',
    recommendedCommand
  };
}
