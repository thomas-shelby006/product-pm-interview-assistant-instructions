export const PROVIDERS = new Set(['chatgpt', 'claude']);
export const ROLES = new Set(['sender', 'receiver']);

export function parseRuntimeConfig(input) {
  const url = input instanceof URL ? input : new URL(input);
  const sessionId = url.searchParams.get('pmia_session')?.trim() || '';
  const role = url.searchParams.get('pmia_role')?.trim().toLowerCase() || '';
  const provider = url.searchParams.get('pmia_provider')?.trim().toLowerCase() || '';
  if (!sessionId || !ROLES.has(role) || !PROVIDERS.has(provider)) return null;
  return { sessionId, role, provider };
}

export function makeEnvelope({
  sessionId,
  sourceProvider,
  text,
  kind = 'question',
  metadata = {},
  now = Date.now()
}) {
  const normalized = String(text ?? '').trim();
  if (!sessionId || !PROVIDERS.has(sourceProvider) || !normalized) {
    throw new TypeError('Invalid PMIA envelope input');
  }
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    sessionId,
    sourceProvider,
    kind,
    text: normalized,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    createdAt: now
  };
}

export function isEnvelope(value) {
  return Boolean(
    value && typeof value === 'object' && value.id && value.sessionId &&
    PROVIDERS.has(value.sourceProvider) && typeof value.text === 'string' && value.text.trim()
  );
}
