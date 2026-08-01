function step(id, label, complete, command = '', blocker = '') {
  return { id, label, complete: Boolean(complete), command: complete ? '' : command, blocker: complete ? '' : blocker };
}

export function derivePreflightWizard(snapshot = {}) {
  const gap = snapshot.sequenceGap || snapshot.gap || {};
  const pressure = snapshot.storagePressure || {};
  const steps = [
    step('roles', 'Both managed roles are Ready', snapshot.sender?.phase === 'ready' && snapshot.receiver?.phase === 'ready', 'check_live', 'roles_not_ready'),
    step('adapters', 'Provider adapters are complete', snapshot.sender?.adapterCapabilities?.complete === true && snapshot.receiver?.adapterCapabilities?.complete === true, 'check_live', 'adapter_incomplete'),
    step('context', 'Session context is armed', snapshot.contextArmed === true, 'resend_context', 'context_not_armed'),
    step('self_test', 'Active runtime self-test passed', snapshot.selfTest?.ok === true && snapshot.selfTest?.trust?.state !== 'failed', 'run_self_test', 'self_test_missing'),
    step('storage', 'Session storage has safe headroom', pressure.level !== 'critical', 'compact_proven', 'storage_critical'),
    step('sequence', 'Sequence admission has no gap', !gap.blocked && !gap.missingSeq, 'check_live', 'sequence_gap'),
    step('dashboard', 'Runtime Pilot is connected', Number(snapshot.dashboardConnections || 0) > 0, '', 'dashboard_not_connected')
  ];
  const current = steps.find(item => !item.complete) || null;
  return { ready: !current, completed: steps.filter(item => item.complete).length, total: steps.length, steps, current };
}
