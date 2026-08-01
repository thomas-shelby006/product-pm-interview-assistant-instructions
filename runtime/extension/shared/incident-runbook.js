const RUNBOOKS = Object.freeze({
  state_compatibility: [
    { id: 'inspect_state', label: 'Inspect state compatibility', command: 'check_live' },
    { id: 'export_support', label: 'Export safe support evidence', command: 'export_support_bundle' },
    { id: 'operator_handoff', label: 'Keep delivery protected until state is recovered', command: '' }
  ],
  storage_critical: [
    { id: 'compact', label: 'Compact proven history', command: 'compact_proven' },
    { id: 'check_live', label: 'Recheck storage pressure', command: 'check_live' }
  ],
  provider_capability_blocked: [
    { id: 'self_test', label: 'Run the no-content self-test', command: 'run_self_test' },
    { id: 'repair', label: 'Repair the affected runtime', command: 'repair_runtime' },
    { id: 'verify', label: 'Verify provider capabilities', command: 'check_live' }
  ],
  registration_missing: [
    { id: 'check_live', label: 'Check managed role ownership', command: 'check_live' },
    { id: 'repair', label: 'Recover the missing runtime', command: 'repair_runtime' },
    { id: 'verify', label: 'Verify both roles', command: 'run_self_test' }
  ],
  sequence_gap: [
    { id: 'catch_up', label: 'Reconcile the protected sequence gap', command: 'resume_catch_up' },
    { id: 'verify', label: 'Verify contiguous delivery', command: 'check_live' }
  ],
  proof_failed: [
    { id: 'inspect', label: 'Inspect rendered proof', command: 'check_live' },
    { id: 'catch_up', label: 'Retry unresolved proof safely', command: 'resume_catch_up' }
  ],
  transport_unavailable: [
    { id: 'self_test', label: 'Probe both transport roles', command: 'run_self_test' },
    { id: 'repair', label: 'Repair transport ownership', command: 'repair_runtime' },
    { id: 'verify', label: 'Verify direct or fallback delivery', command: 'check_live' }
  ]
});

const DEFAULT = Object.freeze([
  { id: 'check_live', label: 'Check the current runtime', command: 'check_live' },
  { id: 'repair', label: 'Run bounded repair', command: 'repair_runtime' },
  { id: 'verify', label: 'Verify recovery', command: 'run_self_test' }
]);

export function deriveIncidentRunbook(incident = {}, snapshot = {}) {
  const code = String(incident.code || 'unknown');
  const source = RUNBOOKS[code] || DEFAULT;
  const selfTestHealthy = snapshot.selfTest?.ok === true;
  const consistencyHealthy = snapshot.consistencyAudit?.ok !== false;
  const deliveryHealthy = snapshot.deliveryPolicy?.active !== true;
  const steps = source.map((step, index) => {
    const complete = step.id === 'self_test' ? selfTestHealthy
      : step.id === 'verify' ? selfTestHealthy && consistencyHealthy && deliveryHealthy
        : step.id === 'check_live' ? consistencyHealthy : false;
    return { ...step, index, state: complete ? 'complete' : 'pending' };
  });
  const currentIndex = Math.max(0, steps.findIndex(step => step.state !== 'complete'));
  return {
    incidentId: String(incident.id || ''),
    code,
    steps,
    currentIndex,
    current: steps[currentIndex] || null,
    complete: steps.length > 0 && steps.every(step => step.state === 'complete')
  };
}
