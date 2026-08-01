function roleStatus(registration, now, staleAfterMs) {
  if (!registration) return { connected: false, provider: '', ageMs: null };
  const registeredAt = Number(registration.registeredAt || 0);
  const ageMs = Math.max(0, now - registeredAt);
  return {
    connected: true,
    provider: String(registration.provider || ''),
    ageMs,
    stale: Boolean(registeredAt && ageMs > staleAfterMs)
  };
}

export function buildSessionStatus(
  session,
  now = Date.now(),
  staleAfterMs = 45_000
) {
  return {
    sender: roleStatus(session?.sender, now, staleAfterMs),
    receiver: roleStatus(session?.receiver, now, staleAfterMs),
    hasPending: Boolean(session?.pending)
  };
}

export function describeRuntimeStatus(status, counterpart = null) {
  const queueCount = Math.max(0, Number(status?.queueCount) || 0);
  if (status?.transportMode === 'paused') {
    return {
      text: queueCount ? `PAUSED - ${queueCount} QUEUED` : 'FORWARDING PAUSED',
      tone: 'warn'
    };
  }
  if (queueCount) return { text: `${queueCount} FINAL${queueCount === 1 ? '' : 'S'} QUEUED`, tone: 'warn' };
  if (status?.hasPending) return { text: 'FINAL QUEUED', tone: 'warn' };
  const sender = Boolean(status?.sender?.connected);
  const receiver = Boolean(status?.receiver?.connected);
  if (!sender && !receiver) return { text: 'WAITING SENDER + RECEIVER', tone: 'error' };
  if (!sender) return { text: 'WAITING SENDER', tone: 'warn' };
  if (!receiver) return { text: 'WAITING RECEIVER', tone: 'warn' };
  if (counterpart && !counterpart.responsive) {
    return { text: 'RUNTIME UNREACHABLE', tone: 'error' };
  }
  if (counterpart?.responsive && !counterpart.composerAvailable) {
    return { text: 'COMPOSER NOT READY', tone: 'warn' };
  }
  return { text: 'LINK OK', tone: 'ok' };
}
