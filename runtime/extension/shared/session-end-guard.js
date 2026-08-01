const FINAL_STATES = new Set(['proven', 'archived']);
const IN_FLIGHT_STATES = new Set(['submitting', 'submitted']);

function latestOutboxCount(snapshot) {
  if (snapshot?.senderOutboxState && Number.isFinite(Number(snapshot.senderOutboxState.count))) {
    return Math.max(0, Number(snapshot.senderOutboxState.count || 0));
  }
  const timeline = Array.isArray(snapshot?.timeline) ? snapshot.timeline : [];
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    if (timeline[index]?.type === 'outbox_state') return Math.max(0, Number(timeline[index]?.data?.count || 0));
  }
  return 0;
}

export function senderOutboxStorageKey(sessionId) {
  return `pmia_sender_outbox_v2:${String(sessionId || '').trim()}`;
}

export function sessionEndCounts(snapshot) {
  const ledger = Array.isArray(snapshot?.ledger) ? snapshot.ledger : [];
  const actionable = ledger.filter(item => !FINAL_STATES.has(String(item?.state || ''))).length;
  const inFlightLedger = ledger.filter(item => IN_FLIGHT_STATES.has(String(item?.state || ''))).length;
  const activeMembers = Number(snapshot?.batchState?.active?.questionCount || snapshot?.batchState?.active?.memberIds?.length || 0);
  const phase = String(snapshot?.liveSession?.phase || 'setup');
  const liveActive = ['active','paused'].includes(phase) ? 1 : 0;
  return {
    actionable,
    inFlight: Math.max(inFlightLedger, activeMembers),
    unpersisted: latestOutboxCount(snapshot),
    liveActive,
    phase
  };
}

export function prepareSessionEnd(snapshot, {
  now = Date.now(),
  token = globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2)}`,
  ttlMs = 30000
} = {}) {
  const counts = sessionEndCounts(snapshot);
  return {
    token: String(token),
    preparedAt: Number(now),
    expiresAt: Number(now) + Math.max(5000, Number(ttlMs) || 30000),
    counts,
    canEnd: counts.actionable === 0 && counts.inFlight === 0 && counts.unpersisted === 0 && counts.liveActive === 0
  };
}

export function validateSessionEnd(prepared, { token, mode, now = Date.now() } = {}) {
  if (!prepared?.token || String(token || '') !== String(prepared.token)) return { ok: false, error: 'confirmation_token_invalid' };
  if (Number(now) > Number(prepared.expiresAt || 0)) return { ok: false, error: 'confirmation_token_expired' };
  const normalizedMode = String(mode || 'clean');
  if (!prepared.canEnd && normalizedMode !== 'archive_and_end') return { ok: false, error: 'actionable_finals_present', counts: prepared.counts };
  if (!['clean', 'archive_and_end'].includes(normalizedMode)) return { ok: false, error: 'invalid_end_mode' };
  return { ok: true, mode: normalizedMode, counts: prepared.counts };
}
