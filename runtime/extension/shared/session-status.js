function roleStatus(registration, now, staleAfterMs) {
  if (!registration) return { connected: false, provider: '', ageMs: null };
  const registeredAt = Number(registration.registeredAt || 0);
  const ageMs = Math.max(0, now - registeredAt);
  return {
    connected: Boolean(registeredAt && ageMs <= staleAfterMs),
    provider: String(registration.provider || ''),
    ageMs
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

export function describeRuntimeStatus(status) {
  if (status?.hasPending) return { text: 'FINAL QUEUED', tone: 'warn' };
  const sender = Boolean(status?.sender?.connected);
  const receiver = Boolean(status?.receiver?.connected);
  if (sender && receiver) return { text: 'LINK OK', tone: 'ok' };
  if (!sender && !receiver) return { text: 'WAITING SENDER + RECEIVER', tone: 'error' };
  return sender
    ? { text: 'WAITING RECEIVER', tone: 'warn' }
    : { text: 'WAITING SENDER', tone: 'warn' };
}
