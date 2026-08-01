export function deriveOutboxStatus(snapshot, now = Date.now()) {
  const timeline = Array.isArray(snapshot?.timeline) ? snapshot.timeline : [];
  let event = null;
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    if (timeline[index]?.type === 'outbox_state') { event = timeline[index]; break; }
  }
  const data = event?.data || {};
  const count = Number(data.count || 0);
  const nextRetryAt = Number(data.nextRetryAt || 0);
  return {
    count,
    replaying: Boolean(data.replaying),
    attempts: Number(data.attempts || 0),
    lastError: String(data.lastError || ''),
    retryInMs: nextRetryAt ? Math.max(0, nextRetryAt - Number(now)) : 0,
    state: !count ? 'clear' : data.replaying ? 'retrying' : nextRetryAt ? 'waiting' : 'retained'
  };
}
