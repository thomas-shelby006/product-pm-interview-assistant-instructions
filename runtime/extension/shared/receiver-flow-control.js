export function deriveReceiverCredits({
  bufferedCount = 0,
  maxBuffered = 200,
  activeMembers = 0,
  hold = false,
  paused = false,
  storageCritical = false,
  draftConflict = false
} = {}) {
  const capacity = Math.max(1, Number(maxBuffered) || 200);
  const buffered = Math.max(0, Number(bufferedCount) || 0);
  const active = Math.max(0, Number(activeMembers) || 0);
  let reason = '';
  if (storageCritical) reason = 'storage_critical';
  else if (paused) reason = 'transport_paused';
  else if (hold) reason = 'operator_hold';
  else if (draftConflict) reason = 'draft_conflict';
  const available = reason ? 0 : Math.max(0, capacity - buffered - Math.min(active, capacity));
  return {
    state: available > 0 ? 'available' : 'backpressure',
    canAccept: available > 0,
    available,
    capacity,
    buffered,
    active,
    reason: reason || (available ? 'credit_available' : 'buffer_capacity_exhausted'),
    retryAfterMs: available ? 0 : 250
  };
}