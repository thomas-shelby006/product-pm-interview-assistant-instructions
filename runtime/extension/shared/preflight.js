import { buildSessionStatus } from './session-status.js';

function counterpartResult(role, registration, reason) {
  return {
    responsive: false,
    role,
    provider: String(registration?.provider || ''),
    version: '',
    composerAvailable: false,
    reason
  };
}

export async function runCounterpartPreflight({
  registry,
  sessionId,
  requesterTabId,
  sendToTab,
  now = Date.now(),
  staleAfterMs = 45_000
}) {
  const requesterRole = registry?.roleForTab?.(sessionId, requesterTabId);
  if (!requesterRole) return { ok: false, error: 'session_not_owned' };

  const session = registry.getSession(sessionId);
  const status = buildSessionStatus(session, now, staleAfterMs);
  const counterpartRole = requesterRole === 'sender' ? 'receiver' : 'sender';
  const registration = session?.[counterpartRole] || null;

  if (!registration) {
    return {
      ok: true,
      status,
      counterpart: counterpartResult(counterpartRole, null, 'missing')
    };
  }

  try {
    const response = await sendToTab(registration.tabId, {
      type: 'PMIA_PREFLIGHT_PING',
      sessionId,
      requesterRole
    });
    if (!response?.ok || response.role !== counterpartRole) {
      return {
        ok: true,
        status,
        counterpart: counterpartResult(counterpartRole, registration, 'invalid_response')
      };
    }
    return {
      ok: true,
      status,
      counterpart: {
        responsive: true,
        role: counterpartRole,
        provider: String(response.provider || registration.provider || ''),
        version: String(response.version || ''),
        composerAvailable: Boolean(response.composerAvailable),
        reason: ''
      }
    };
  } catch {
    return {
      ok: true,
      status,
      counterpart: counterpartResult(counterpartRole, registration, 'unreachable')
    };
  }
}
