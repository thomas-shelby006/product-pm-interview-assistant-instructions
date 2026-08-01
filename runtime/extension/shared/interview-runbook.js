function step(id, label, complete, action, detail = '') {
  return { id, label, complete: Boolean(complete), action: complete ? '' : action, detail: String(detail || '') };
}

export function deriveInterviewRunbook(snapshot = {}, now = Date.now()) {
  const sender = snapshot.sender || {};
  const receiver = snapshot.receiver || {};
  const selfTestAge = snapshot.selfTest?.completedAt ? Math.max(0, Number(now) - Number(snapshot.selfTest.completedAt)) : Infinity;
  const steps = [
    step('roles', 'Window 1 and Window 2 connected', sender.connected && receiver.connected, 'repair_runtime'),
    step('composers', 'Both provider composers ready', sender.composerReady && receiver.composerReady, 'check_live'),
    step('adapters', 'Provider capability checks passed', sender.adapterCapabilityProbation?.writeSafe !== false && receiver.adapterCapabilityProbation?.writeSafe !== false && sender.adapterCapabilities?.complete === true && receiver.adapterCapabilities?.complete === true, 'check_live'),
    step('context', 'Session context armed', snapshot.contextArmed, 'resend_context'),
    step('self_test', 'Active control-plane self-test passed', snapshot.selfTest?.ok === true && selfTestAge <= 30_000, 'run_self_test'),
    step('storage', 'Session storage below critical pressure', snapshot.storagePressure?.level !== 'critical', 'compact_proven'),
    step('delivery', 'No blocking sequence, proof, or consistency issue', !snapshot.deliveryPolicy?.active && snapshot.consistencyAudit?.ok !== false && !snapshot.warnings?.some(item => ['sequence_gap','receiver_proof_failed'].includes(item.code)), 'check_live')
  ];
  const incomplete = steps.filter(item => !item.complete);
  return {
    steps,
    completed: steps.length - incomplete.length,
    total: steps.length,
    ready: incomplete.length === 0,
    next: incomplete[0] || null,
    percent: Math.round(((steps.length - incomplete.length) / steps.length) * 100)
  };
}
