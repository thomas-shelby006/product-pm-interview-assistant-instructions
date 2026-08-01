function parseLegacy(storage, key) {
  if (!storage?.getItem || !key) return [];
  try {
    const value = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function responseError(response, fallback) {
  return new Error(String(response?.error || fallback));
}

export async function createSessionStorageAdapter({
  send,
  sessionId,
  legacyStorage = null,
  legacyKey = ''
} = {}) {
  if (typeof send !== 'function' || !String(sessionId || '').trim()) {
    throw new TypeError('Session storage adapter requires send and sessionId');
  }
  const request = async (type, value) => {
    const response = await send({ type, sessionId: String(sessionId), namespace: 'sender_outbox', ...(value === undefined ? {} : { value }) });
    if (!response?.ok) throw responseError(response, 'session_storage_failed');
    return response;
  };
  const loaded = await request('PMIA_SESSION_STATE_GET');
  let initialEntries = Array.isArray(loaded.value) ? loaded.value : [];
  let recoverySource = initialEntries.length ? 'extension_session' : 'empty';
  if (!initialEntries.length) {
    const legacyEntries = parseLegacy(legacyStorage, legacyKey);
    if (legacyEntries.length) {
      await request('PMIA_SESSION_STATE_SET', legacyEntries);
      legacyStorage?.removeItem?.(legacyKey);
      initialEntries = legacyEntries;
      recoverySource = 'legacy_migrated';
    }
  }
  return {
    initialEntries,
    restoredCount: initialEntries.length,
    recoverySource,
    async save(entries) { await request('PMIA_SESSION_STATE_SET', entries); return true; },
    async clear() { await request('PMIA_SESSION_STATE_REMOVE'); return true; }
  };
}
