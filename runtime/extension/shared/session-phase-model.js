export const SESSION_PHASES = Object.freeze(['setup', 'ready', 'active', 'paused', 'debrief', 'ended']);

const ALLOWED = Object.freeze({
  setup: new Set(['ready', 'ended']),
  ready: new Set(['setup', 'active', 'ended']),
  active: new Set(['paused', 'debrief', 'ended']),
  paused: new Set(['active', 'debrief', 'ended']),
  debrief: new Set(['active', 'ended']),
  ended: new Set()
});

export function canTransitionSessionPhase(from, to) {
  const current = SESSION_PHASES.includes(String(from)) ? String(from) : 'setup';
  const next = String(to || '');
  return current === next || Boolean(ALLOWED[current]?.has(next));
}

export function transitionSessionPhase(current = {}, nextPhase, now = Date.now(), reason = 'operator') {
  const from = SESSION_PHASES.includes(String(current.phase)) ? String(current.phase) : 'setup';
  const to = String(nextPhase || '');
  if (!SESSION_PHASES.includes(to)) return { ok: false, error: 'invalid_session_phase', phase: from };
  if (!canTransitionSessionPhase(from, to)) return { ok: false, error: 'invalid_session_transition', phase: from, requested: to };
  if (from === to) return { ok: true, changed: false, value: { ...current, phase: from } };
  const at = Number(now) || Date.now();
  const history = [...(Array.isArray(current.history) ? current.history : []), { from, to, at, reason: String(reason || 'operator') }].slice(-64);
  return { ok: true, changed: true, value: { ...current, phase: to, phaseChangedAt: at, history } };
}

export function deriveSessionPhase(snapshot = {}) {
  const phase = SESSION_PHASES.includes(String(snapshot.liveSession?.phase))
    ? String(snapshot.liveSession.phase) : 'setup';
  const ledger = Array.isArray(snapshot.ledger) ? snapshot.ledger : [];
  const unresolved = ledger.filter(item => !['proven', 'archived'].includes(String(item.state || '')));
  const answer = String(snapshot.answerState?.state || 'idle');
  const activity = ['waiting', 'streaming'].includes(answer) ? 'answering'
    : snapshot.batchState?.active ? 'delivering'
      : unresolved.length ? 'questions_waiting'
        : ledger.length ? 'caught_up' : 'idle';
  const blockers = [];
  if (!snapshot.contextArmed) blockers.push('context_unarmed');
  if (snapshot.selfTest?.ok !== true) blockers.push('self_test_required');
  if (snapshot.deliveryPolicy?.active) blockers.push(snapshot.deliveryPolicy.reason || 'protected_delivery');
  if (snapshot.consistencyAudit?.ok === false) blockers.push(snapshot.consistencyAudit.reason || 'consistency_failed');
  const rank = SESSION_PHASES.indexOf(phase);
  return {
    phase, activity, rank,
    completed: SESSION_PHASES.filter((_, index) => index < rank),
    blockers: [...new Set(blockers)],
    nextAction: blockers[0] || (phase === 'setup' ? 'complete_runbook' : phase === 'ready' ? 'start_mock' : phase === 'debrief' ? 'prepare_end_session' : 'continue')
  };
}

export function applyPhaseCheckpoint(history = [], phase, now = Date.now(), source = 'operator') {
  const value = SESSION_PHASES.includes(String(phase)) ? String(phase) : '';
  if (!value) return history.slice(-64);
  const prior = history.at(-1);
  if (prior?.to === value && prior?.reason === source) return history.slice(-64);
  return [...history, { from: prior?.to || '', to: value, at: Number(now), reason: String(source || 'operator') }].slice(-64);
}
