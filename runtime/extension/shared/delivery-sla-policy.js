const ACTIONABLE_STATES = new Set(['persisted', 'failed', 'submitting', 'submitted']);

function oldestActionable(snapshot) {
  const entries = (Array.isArray(snapshot?.ledger) ? snapshot.ledger : [])
    .filter(entry => ACTIONABLE_STATES.has(String(entry?.state || '')))
    .map(entry => ({
      ...entry,
      at: Number(entry.persistedAt || entry.createdAt || entry.updatedAt || 0)
    }))
    .filter(entry => entry.at > 0)
    .sort((a, b) => a.at - b.at);
  return entries[0] || null;
}

export function deriveDeliverySla(snapshot, now = Date.now(), {
  catchUpMs = 20000,
  checkMs = 45000,
  repairMs = 90000,
  cooldownMs = 30000
} = {}) {
  const oldest = oldestActionable(snapshot);
  const oldestAgeMs = oldest ? Math.max(0, Number(now) - oldest.at) : 0;
  const base = {
    state: oldest ? 'healthy' : 'clear',
    action: '',
    nextAction: '',
    oldestId: String(oldest?.id || ''),
    oldestAt: Number(oldest?.at || 0),
    oldestAgeMs,
    targetMs: catchUpMs,
    evaluatedAt: Number(now),
    reason: ''
  };
  if (!oldest) return base;
  if (snapshot?.receiver?.generating) return { ...base, state: 'answering', reason: 'receiver_generating' };
  if (snapshot?.mode === 'paused' || snapshot?.storagePressure?.level === 'critical') {
    return { ...base, state: 'suppressed', reason: snapshot?.mode === 'paused' ? 'transport_paused' : 'storage_critical' };
  }
  const lastActionAt = Number(snapshot?.deliverySla?.lastActionAt || 0);
  if (lastActionAt && Number(now) - lastActionAt < cooldownMs) {
    return {
      ...base,
      state: 'cooldown',
      reason: 'action_cooldown',
      nextAction: String(snapshot?.deliverySla?.lastAction || '')
    };
  }
  if (oldestAgeMs >= repairMs) return { ...base, state: 'repair_due', action: 'repair', nextAction: 'repair_runtime' };
  if (oldestAgeMs >= checkMs) return { ...base, state: 'check_due', action: 'check_live', nextAction: 'check_live' };
  if (oldestAgeMs >= catchUpMs) return { ...base, state: 'catch_up_due', action: 'catch_up', nextAction: 'resume_catch_up' };
  return { ...base, nextAction: 'wait' };
}
