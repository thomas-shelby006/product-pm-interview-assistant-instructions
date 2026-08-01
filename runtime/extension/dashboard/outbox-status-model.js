export function deriveOutboxStatus(snapshot, now = Date.now()) {
  const timeline = Array.isArray(snapshot?.timeline) ? snapshot.timeline : [];
  let event = null;
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    if (timeline[index]?.type === 'outbox_state') { event = timeline[index]; break; }
  }
  const data = snapshot?.senderOutboxState && typeof snapshot.senderOutboxState === 'object'
    ? snapshot.senderOutboxState
    : event?.data || {};
  const count = Math.max(0, Number(data.count || 0));
  const retryIntent = data.retryIntent && typeof data.retryIntent === 'object' ? data.retryIntent : null;
  const nextRetryAt = Math.max(0, Number(retryIntent?.dueAt || data.nextRetryAt || 0));
  return {
    count,
    replaying: Boolean(data.replaying),
    attempts: Math.max(0, Number(retryIntent?.attempt || data.attempts || 0)),
    lastError: String(data.lastError || retryIntent?.reason || ''),
    persistenceError: String(data.persistenceError || ''),
    restoredCount: Math.max(0, Number(data.restoredCount || 0)),
    recoverySource: String(data.recoverySource || ''),
    retrySource: String(retryIntent?.source || ''),
    retryEnvelopeId: String(retryIntent?.envelopeId || ''),
    nextRetryAt,
    retryInMs: nextRetryAt ? Math.max(0, nextRetryAt - Number(now)) : 0,
    state: !count ? 'clear' : data.replaying ? 'retrying' : nextRetryAt ? 'waiting' : 'retained'
  };
}