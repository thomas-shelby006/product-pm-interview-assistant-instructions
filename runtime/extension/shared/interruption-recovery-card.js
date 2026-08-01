export function deriveInterruptionRecoveryCard(snapshot = {}, checkpoint = null, now = Date.now()) {
  const cp = checkpoint || snapshot.checkpoint || null;
  const activeSession = ['active', 'paused'].includes(String(snapshot.liveSession?.phase || ''));
  const runtimeIssue = ['blocked', 'degraded', 'repairing'].includes(String(snapshot.mode || ''))
    || snapshot.sender?.connected === false || snapshot.receiver?.connected === false
    || snapshot.deliveryPolicy?.active === true;
  if (!cp || !activeSession || !runtimeIssue) return { visible: false, steps: [], current: null };
  const steps = [
    { id: 'inspect', label: 'Inspect current runtime evidence', command: 'check_live', complete: snapshot.consistencyAudit?.ok === true },
    { id: 'self_test', label: 'Verify both managed roles', command: 'run_self_test', complete: snapshot.selfTest?.ok === true },
    { id: 'repair', label: 'Repair the owning failure if required', command: 'repair_runtime', complete: snapshot.mode === 'active' && snapshot.deliveryPolicy?.active !== true },
    { id: 'resume', label: `Resume from ${cp.phase} checkpoint`, command: 'resume_checkpoint', complete: false }
  ];
  const current = steps.find(step => !step.complete) || steps.at(-1);
  return {
    visible: true,
    checkpoint: cp,
    ageMs: Math.max(0, Number(now) - Number(cp.createdAt || now)),
    steps,
    current,
    retainedFinals: cp.unresolvedCount,
    activeBatchId: cp.activeBatchId,
    nextBatchId: cp.nextBatchId
  };
}
