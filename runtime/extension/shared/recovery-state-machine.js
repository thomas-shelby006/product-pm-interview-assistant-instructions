export const RECOVERY_CHECKS = ['sender', 'receiver', 'adapters', 'reconciliation', 'batch', 'storage'];

function emptyChecks() {
  return Object.fromEntries(RECOVERY_CHECKS.map(key => [key, false]));
}

function normalized(current = {}) {
  return {
    ...current,
    phase: ['healthy', 'repairing', 'degraded', 'blocked'].includes(current?.phase) ? current.phase : 'healthy',
    checks: { ...emptyChecks(), ...(current?.checks || {}) },
    attempts: Math.max(0, Number(current?.attempts || 0)),
    startedAt: Number(current?.startedAt || 0),
    updatedAt: Number(current?.updatedAt || 0),
    verified: Boolean(current?.verified),
    pendingVerification: Boolean(current?.pendingVerification),
    error: String(current?.error || '')
  };
}

export function recoveryChecksComplete(checks = {}) {
  return RECOVERY_CHECKS.every(key => checks[key] === true);
}

export function transitionRecovery(current, event = {}, now = Date.now()) {
  const state = normalized(current);
  const type = String(event?.type || '');
  if (type === 'repair_requested') {
    return {
      ...state,
      phase: 'repairing',
      checks: emptyChecks(),
      attempts: state.attempts + 1,
      startedAt: now,
      updatedAt: now,
      verified: false,
      pendingVerification: true,
      error: '',
      actions: event.actions || [],
      unresolved: event.unresolved || []
    };
  }
  if (type === 'checks_updated') {
    const checks = { ...state.checks, ...(event.checks || {}) };
    const blocked = checks.storage === false && event.storageCritical === true;
    return {
      ...state,
      phase: blocked ? 'blocked' : state.phase === 'blocked' ? 'repairing' : state.phase,
      checks,
      updatedAt: now,
      pendingVerification: !recoveryChecksComplete(checks),
      verified: recoveryChecksComplete(checks),
      error: blocked ? 'storage_pressure' : state.error === 'storage_pressure' ? '' : state.error
    };
  }
  if (type === 'verify') {
    const complete = recoveryChecksComplete(state.checks);
    return {
      ...state,
      phase: complete ? 'healthy' : state.phase === 'blocked' ? 'blocked' : 'repairing',
      updatedAt: now,
      verified: complete,
      pendingVerification: !complete,
      error: complete ? '' : state.error
    };
  }
  if (type === 'blocked') return { ...state, phase: 'blocked', updatedAt: now, verified: false, pendingVerification: true, error: String(event.error || 'blocked') };
  if (type === 'failure' || type === 'timeout' || type === 'role_disconnected') {
    return { ...state, phase: 'degraded', updatedAt: now, verified: false, pendingVerification: false, error: String(event.error || type) };
  }
  return state;
}
