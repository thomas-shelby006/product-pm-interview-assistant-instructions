const CHECKS = Object.freeze([
  ['handshake', 'handshake'],
  ['direct', 'direct'],
  ['fallback', 'fallback'],
  ['reconnect', 'reconnect'],
  ['selective_nack', 'selectiveNack'],
  ['alarm_audit', 'alarmAudit'],
  ['invariant_audit', 'invariantAudit'],
  ['state_compatibility', 'stateCompatibility'],
  ['index_audit', 'indexAudit'],
  ['capability_probation', 'capabilityProbation'],
  ['queue_only_policy', 'queueOnlyPolicy'],
  ['restart_continuity', 'restartContinuity']
]);

function safeData(result) {
  if (!result || typeof result !== 'object') return {};
  return Object.fromEntries(Object.entries(result).filter(([key]) => ![
    'text', 'prompt', 'answer', 'setup', 'clipboard', 'credentials', 'token'
  ].includes(String(key).toLowerCase())));
}

export async function runTransportDrill(operations = {}) {
  const now = typeof operations.now === 'function' ? operations.now : Date.now;
  const startedAt = Number(now());
  const checks = [];
  for (const [name, operationName] of CHECKS) {
    const operation = operations[operationName];
    const checkStarted = Number(now());
    let result;
    try {
      result = typeof operation === 'function' ? await operation() : { ok: false, error: 'check_unavailable' };
    } catch (error) {
      result = { ok: false, error: String(error?.message || error) };
    }
    const check = {
      name,
      ok: result?.ok === true,
      error: result?.ok === true ? '' : String(result?.error || 'check_failed'),
      durationMs: Math.max(0, Number(now()) - checkStarted),
      data: safeData(result)
    };
    checks.push(check);
    try { operations.onCheck?.(check); } catch {}
  }
  return {
    ok: checks.every(check => check.ok),
    checks,
    startedAt,
    completedAt: Number(now()),
    elapsedMs: Math.max(0, Number(now()) - startedAt),
    contentAccessed: false
  };
}
