function lane(value = {}, now = Date.now()) {
  const state = String(value?.state || 'unknown');
  const mode = String(value?.lastMode || '');
  const label = state === 'open' ? 'Open circuit'
    : state === 'probing' ? 'Probing'
      : mode === 'fallback' ? 'Fallback'
        : state === 'closed' ? 'Direct'
          : 'Unknown';
  return {
    state,
    mode,
    label,
    tone: state === 'open' ? 'error' : state === 'probing' || mode === 'fallback' ? 'warn' : state === 'closed' ? 'ok' : 'muted',
    rttMs: Math.max(0, Number(value?.lastRttMs || 0)),
    failures: Math.max(0, Number(value?.consecutiveFailures || 0)),
    retryInMs: value?.nextProbeAt ? Math.max(0, Number(value.nextProbeAt) - Number(now)) : 0,
    reason: String(value?.lastFailureReason || '')
  };
}

export function deriveTransportLanes(snapshot, now = Date.now()) {
  return {
    sender: lane(snapshot?.sender?.transportLane, now),
    receiver: lane(snapshot?.receiver?.transportLane, now)
  };
}
