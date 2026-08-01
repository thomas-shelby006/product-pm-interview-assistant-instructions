function lane(value = {}, now = Date.now()) {
  const state = String(value?.state || 'unknown');
  const mode = String(value?.lastMode || '');
  const preferredMode = String(value?.preferredMode || (state === 'closed' ? 'direct' : 'fallback'));
  const score = Math.max(0, Math.min(100, Number(value?.score) || 0));
  const label = state === 'open' ? 'Open circuit'
    : state === 'probing' || state === 'half_open' ? 'Probing'
      : mode === 'fallback' || preferredMode === 'fallback' ? 'Fallback'
        : state === 'closed' ? 'Direct'
          : 'Unknown';
  return {
    state,
    mode,
    preferredMode,
    label,
    tone: state === 'open' || score < 20 ? 'error'
      : state === 'probing' || mode === 'fallback' || preferredMode === 'fallback' || score < 70 ? 'warn'
        : state === 'closed' ? 'ok' : 'muted',
    score,
    scoreState: String(value?.scoreState || 'unknown'),
    scoreReason: String(value?.scoreReason || ''),
    rttMs: Math.max(0, Number(value?.lastRttMs || 0)),
    failures: Math.max(0, Number(value?.consecutiveFailures || 0)),
    retryInMs: value?.nextProbeAt ? Math.max(0, Number(value.nextProbeAt) - Number(now)) : 0,
    reason: String(value?.lastFailureReason || ''),
    protocolVersion: Math.max(0, Number(value?.protocolVersion || 0)),
    epoch: Math.max(0, Number(value?.epoch || 0)),
    capabilities: Array.isArray(value?.capabilities) ? value.capabilities.map(String) : [],
    handshakeReady: Boolean(value?.handshakeReady)
  };
}

export function deriveTransportLanes(snapshot, now = Date.now()) {
  return {
    sender: lane(snapshot?.sender?.transportLane, now),
    receiver: lane(snapshot?.receiver?.transportLane, now)
  };
}