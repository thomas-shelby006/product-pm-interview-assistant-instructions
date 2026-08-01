export function createRuntimeInstanceId(now = Date.now()) {
  return globalThis.crypto?.randomUUID?.()
    || `pmia-runtime-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateRuntimeInstanceId(storage, key, create = createRuntimeInstanceId) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) throw new TypeError('runtime instance key is required');
  try {
    const existing = String(storage?.getItem?.(normalizedKey) || '').trim();
    if (existing) return existing;
  } catch {
    // Storage access failure falls back to a page-scoped identity.
  }
  const created = String(create() || '').trim();
  if (!created) throw new TypeError('runtime instance ID is required');
  try { storage?.setItem?.(normalizedKey, created); } catch {}
  return created;
}

export function shouldApplyRoleRevocation(runtimeConfig, runtimeInstanceId, incoming) {
  if (incoming?.type !== 'PMIA_ROLE_REVOKED') return false;
  if (String(incoming.sessionId || '') !== String(runtimeConfig?.sessionId || '')) return false;
  if (String(incoming.role || '') !== String(runtimeConfig?.role || '')) return false;
  const targetInstanceId = String(incoming.instanceId || '').trim();
  return !targetInstanceId || targetInstanceId === String(runtimeInstanceId || '').trim();
}
