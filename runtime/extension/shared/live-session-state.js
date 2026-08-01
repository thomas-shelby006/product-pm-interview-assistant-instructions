const PHASES = Object.freeze(['setup', 'ready', 'active', 'paused', 'debrief', 'ended']);

function safePhase(value, fallback = 'setup') {
  const phase = String(value || '');
  return PHASES.includes(phase) ? phase : fallback;
}

export function normalizeLiveSession(value = {}, createdAt = Date.now()) {
  const phase = safePhase(value.phase);
  return {
    phase,
    phaseChangedAt: Math.max(0, Number(value.phaseChangedAt || createdAt)),
    history: Array.isArray(value.history) ? value.history.slice(-64).map(item => ({
      phase: safePhase(item.phase), at: Math.max(0, Number(item.at || createdAt)), source: String(item.source || 'runtime').slice(0, 40)
    })) : [],
    startedAt: Math.max(0, Number(value.startedAt || 0)),
    pausedAt: Math.max(0, Number(value.pausedAt || 0)),
    pausedTotalMs: Math.max(0, Number(value.pausedTotalMs || 0)),
    plannedDurationMs: Math.max(0, Number(value.plannedDurationMs || 0)),
    segment: value.segment && typeof value.segment === 'object' ? {
      id: String(value.segment.id || '').slice(0, 80),
      label: String(value.segment.label || '').slice(0, 120),
      startedAt: Math.max(0, Number(value.segment.startedAt || 0)),
      durationMs: Math.max(0, Number(value.segment.durationMs || 0))
    } : null,
    lastInterviewerActivityAt: Math.max(0, Number(value.lastInterviewerActivityAt || 0)),
    focusMode: Boolean(value.focusMode),
    startedBy: String(value.startedBy || '').slice(0, 40)
  };
}

export function transitionLiveSession(value = {}, nextPhase, now = Date.now(), source = 'operator') {
  const current = normalizeLiveSession(value, now);
  const phase = safePhase(nextPhase, current.phase);
  if (phase === current.phase) return current;
  const next = { ...current, phase, phaseChangedAt: now };
  if (phase === 'active' && !next.startedAt) next.startedAt = now;
  if (phase === 'paused' && !next.pausedAt) next.pausedAt = now;
  if (current.phase === 'paused' && phase !== 'paused' && current.pausedAt) {
    next.pausedTotalMs += Math.max(0, now - current.pausedAt);
    next.pausedAt = 0;
  }
  next.history = [...current.history, { phase, at: now, source: String(source || 'operator').slice(0, 40) }].slice(-64);
  return next;
}

export function buildStartMockPlan(snapshot = {}, now = Date.now()) {
  const blockers = [];
  if (!snapshot.sender?.connected || !snapshot.receiver?.connected) blockers.push('roles_missing');
  if (!snapshot.sender?.composerReady || !snapshot.receiver?.composerReady) blockers.push('composers_not_ready');
  if (!snapshot.contextArmed) blockers.push('context_unarmed');
  if (snapshot.selfTest?.ok !== true) blockers.push('self_test_required');
  if (snapshot.deliveryPolicy?.active) blockers.push(snapshot.deliveryPolicy.reason || 'protected_delivery');
  if (snapshot.consistencyAudit?.ok === false) blockers.push(snapshot.consistencyAudit.reason || 'consistency_failed');
  return {
    ok: blockers.length === 0,
    blockers: [...new Set(blockers)],
    actions: blockers.map(code => ({ code, command: code === 'context_unarmed' ? 'resend_context' : code === 'self_test_required' ? 'run_self_test' : 'check_live' })),
    startedAt: Number(now)
  };
}

export function startLiveSession(value = {}, snapshot = {}, options = {}, now = Date.now()) {
  const plan = buildStartMockPlan(snapshot, now);
  if (!plan.ok) return { ok: false, error: 'start_blocked', plan, value: normalizeLiveSession(value, now) };
  let next = transitionLiveSession(value, 'active', now, options.source || 'start_mock');
  next = {
    ...next,
    plannedDurationMs: Math.max(0, Number(options.plannedDurationMs || next.plannedDurationMs || 0)),
    segment: options.segment ? {
      id: String(options.segment.id || 'opening').slice(0, 80),
      label: String(options.segment.label || 'Opening').slice(0, 120),
      startedAt: now,
      durationMs: Math.max(0, Number(options.segment.durationMs || 0))
    } : next.segment,
    lastInterviewerActivityAt: now,
    startedBy: String(options.source || 'operator').slice(0, 40)
  };
  return { ok: true, plan, value: next };
}

export function markInterviewerActivity(value = {}, now = Date.now()) {
  return { ...normalizeLiveSession(value, now), lastInterviewerActivityAt: Number(now) };
}

export function setFocusMode(value = {}, enabled) {
  return { ...normalizeLiveSession(value), focusMode: Boolean(enabled) };
}
