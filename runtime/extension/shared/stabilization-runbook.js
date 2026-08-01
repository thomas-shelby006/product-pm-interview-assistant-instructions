const STEPS = Object.freeze([
  { id: 'self_test', command: 'run_self_test' },
  { id: 'live_check', command: 'check_live' },
  { id: 'consistency', command: 'audit_consistency' },
  { id: 'reconcile', command: 'resume_catch_up' },
  { id: 'repair', command: 'repair_runtime' },
  { id: 'verify', command: 'run_self_test' }
]);

export function buildStabilizationPlan(snapshot = {}) {
  const root = String(snapshot.rootCause?.code || 'healthy');
  const queueOnly = snapshot.deliveryPolicy?.active === true;
  if (root === 'healthy' && snapshot.selfTest?.ok && !queueOnly) return [];
  const selected = [];
  selected.push(STEPS[0], STEPS[1]);
  if (snapshot.consistencyAudit?.ok === false || snapshot.stateAudit?.blocked) selected.push(STEPS[2]);
  if (['sequence_gap', 'proof_failed'].includes(root) || Number(snapshot.ledgerCounts?.persisted || 0) > 0) selected.push(STEPS[3]);
  if (!['storage_critical', 'state_compatibility'].includes(root) && root !== 'healthy') selected.push(STEPS[4]);
  selected.push(STEPS[5]);
  return selected.filter((item, index, list) => list.findIndex(value => value.id === item.id) === index);
}

export function startRunbook(snapshot = {}, now = Date.now()) {
  const steps = buildStabilizationPlan(snapshot).map(item => ({ ...item, state: 'pending', startedAt: 0, completedAt: 0, error: '' }));
  return { id: `stabilize-${now}`, state: steps.length ? 'pending' : 'complete', startedAt: now, completedAt: steps.length ? 0 : now, current: 0, steps };
}

export function advanceRunbook(runbook = {}, result = {}, now = Date.now()) {
  const steps = (runbook.steps || []).map(item => ({ ...item }));
  const index = Math.max(0, Number(runbook.current || 0));
  if (!steps[index]) return { ...runbook, state: 'complete', completedAt: now };
  steps[index] = { ...steps[index], state: result.ok === false ? 'failed' : 'complete', startedAt: steps[index].startedAt || now, completedAt: now, error: String(result.error || '') };
  if (result.ok === false) return { ...runbook, state: 'failed', steps, completedAt: now };
  const next = index + 1;
  return { ...runbook, state: next >= steps.length ? 'complete' : 'running', current: next, steps, completedAt: next >= steps.length ? now : 0 };
}

export function cancelRunbook(runbook = {}, now = Date.now()) {
  return { ...runbook, state: 'cancelled', completedAt: now };
}
