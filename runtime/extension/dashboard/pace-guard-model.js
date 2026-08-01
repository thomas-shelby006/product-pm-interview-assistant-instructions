const ACTIVE_STATES = new Set(['persisted', 'staged', 'submitting', 'failed']);

function eventsWithin(timeline, now, windowMs) {
  const start = Number(now) - Number(windowMs);
  return (Array.isArray(timeline) ? timeline : [])
    .filter(event => Number(event?.at || 0) >= start && Number(event?.at || 0) <= Number(now));
}

function provenIds(events) {
  const ids = new Set();
  for (const event of events) {
    const data = event?.data || {};
    if (event?.type === 'batch_proven') {
      for (const id of Array.isArray(data.memberIds) ? data.memberIds : []) ids.add(String(id));
    } else if (event?.type === 'ledger_item_proven' && data.ledgerItemId) {
      ids.add(String(data.ledgerItemId));
    }
  }
  return ids;
}

function arrivalIds(events) {
  const ids = new Set();
  for (const event of events) {
    if (event?.type !== 'final_persisted') continue;
    const id = String(event?.data?.envelopeId || '');
    if (id) ids.add(id);
  }
  return ids;
}

export function derivePaceGuard(snapshot, now = Date.now(), windowMs = 60_000) {
  const window = Math.max(10_000, Number(windowMs) || 60_000);
  const events = eventsWithin(snapshot?.timeline, now, window);
  const arrivals = arrivalIds(events);
  const proofs = provenIds(events);
  const unresolved = (Array.isArray(snapshot?.ledger) ? snapshot.ledger : [])
    .filter(item => ACTIVE_STATES.has(item?.state));
  const intakePerMinute = Math.round((arrivals.size * 60_000 / window) * 10) / 10;
  const proofPerMinute = Math.round((proofs.size * 60_000 / window) * 10) / 10;
  const netPerMinute = Math.round((intakePerMinute - proofPerMinute) * 10) / 10;
  const blocked = Boolean(
    snapshot?.batchState?.draftConflict
    || snapshot?.storagePressure?.level === 'critical'
    || !snapshot?.receiver?.connected
    || snapshot?.receiver?.phase !== 'ready'
  );
  let state = 'stable';
  if (blocked) state = 'blocked';
  else if (!unresolved.length) state = 'caught_up';
  else if (proofPerMinute > intakePerMinute) state = 'recovering';
  else if (unresolved.length >= 2 && intakePerMinute > proofPerMinute) state = 'falling_behind';
  else state = 'steady_backlog';

  const netRecoveryPerMinute = proofPerMinute - intakePerMinute;
  const estimatedCatchUpMs = unresolved.length && netRecoveryPerMinute > 0
    ? Math.round(unresolved.length / netRecoveryPerMinute * 60_000)
    : unresolved.length ? null : 0;
  const oldestAt = unresolved.length
    ? Math.min(...unresolved.map(item => Number(item.persistedAt || now)))
    : 0;

  return {
    state,
    arrivals: arrivals.size,
    proofs: proofs.size,
    intakePerMinute,
    proofPerMinute,
    netPerMinute,
    unresolved: unresolved.length,
    oldestAgeMs: oldestAt ? Math.max(0, Number(now) - oldestAt) : 0,
    estimatedCatchUpMs,
    windowMs: window
  };
}

export function paceLabel(state) {
  return ({
    caught_up: 'Caught up',
    stable: 'Stable',
    recovering: 'Recovering',
    falling_behind: 'Falling behind',
    steady_backlog: 'Backlog stable',
    blocked: 'Blocked'
  })[state] || 'Unknown';
}
