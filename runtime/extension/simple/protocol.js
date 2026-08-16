const VALID_KINDS = new Set(['question', 'boot']);
const SUCCESS_STAGE = 'rendered';

export function makeTurn({ sessionId, turnId, text, kind = 'question' } = {}) {
  const normalized = Object.freeze({
    sessionId: String(sessionId || '').trim(),
    turnId: String(turnId || '').trim(),
    text: String(text ?? '').trim(),
    kind: VALID_KINDS.has(kind) ? kind : 'question'
  });
  if (!normalized.sessionId || !normalized.turnId || !normalized.text) {
    throw new TypeError('sessionId, turnId and text are required');
  }
  return normalized;
}

export function isSuccessfulRoleResult(result) {
  return String(result?.stage || '') === SUCCESS_STAGE;
}

export function roleDeliveryKey(turn, role) {
  return `${turn.sessionId}:${turn.turnId}:${String(role || '').trim()}`;
}
