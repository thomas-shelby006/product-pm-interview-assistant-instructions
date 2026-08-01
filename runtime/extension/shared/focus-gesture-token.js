function nonce() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

export function issueFocusGesture({ sessionId = '', target = '', action = '', now = Date.now(), ttlMs = 5000, id = '' } = {}) {
  const issuedAt = Math.max(0, Number(now) || Date.now());
  return {
    id: String(id || `focus-${nonce()}`).slice(0, 160),
    sessionId: String(sessionId || '').slice(0, 160),
    target: String(target || '').slice(0, 32),
    action: String(action || '').slice(0, 48),
    issuedAt,
    expiresAt: issuedAt + Math.max(500, Math.min(10000, Number(ttlMs) || 5000))
  };
}

export function validateFocusGesture(value = {}, { sessionId = '', target = '', action = '', now = Date.now(), consumed = null } = {}) {
  const id = String(value.id || '');
  if (!id || !value.sessionId || !value.target || !value.action) return { ok: false, error: 'focus_intent_missing' };
  if (value.sessionId !== String(sessionId) || value.target !== String(target) || value.action !== String(action)) return { ok: false, error: 'focus_intent_mismatch' };
  if (Number(value.issuedAt || 0) > now + 1000 || Number(value.expiresAt || 0) < now) return { ok: false, error: 'focus_intent_expired' };
  if (consumed?.has?.(id)) return { ok: false, error: 'focus_intent_consumed' };
  consumed?.add?.(id);
  return { ok: true, id, issuedAt: Number(value.issuedAt), expiresAt: Number(value.expiresAt) };
}
