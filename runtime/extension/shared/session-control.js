function registeredPair(registry, sessionId) {
  const normalized = String(sessionId || '').trim();
  const session = normalized ? registry?.getSession?.(normalized) : null;
  const senderTabId = session?.sender?.tabId;
  const receiverTabId = session?.receiver?.tabId;
  if (!Number.isInteger(senderTabId) || !Number.isInteger(receiverTabId) || senderTabId === receiverTabId) {
    return null;
  }
  return { sessionId: normalized, senderTabId, receiverTabId };
}

export async function exportManagedSession({ registry, sessionId, sendToTab }) {
  const pair = registeredPair(registry, sessionId);
  if (!pair) return { ok: false, error: 'incomplete_session' };
  const tabIds = [pair.senderTabId, pair.receiverTabId];
  const results = await Promise.all(tabIds.map(tabId => (
    Promise.resolve(sendToTab(tabId, { type: 'PMIA_EXPORT_SESSION', sessionId: pair.sessionId }))
      .catch(error => ({ ok: false, error: String(error?.message || error) }))
  )));
  const failure = results.find(result => !result?.ok);
  if (failure) return { ok: false, error: failure.error || 'export_failed' };
  return { ok: true, exportedTabIds: tabIds };
}

export async function exportManagedSessionForTab({ registry, tabId, sendToTab }) {
  if (!Number.isInteger(tabId)) return { ok: false, error: 'unmanaged_active_tab' };
  const matches = registry.exportState().filter(session => (
    session.sender?.tabId === tabId || session.receiver?.tabId === tabId
  ));
  if (matches.length === 0) return { ok: false, error: 'unmanaged_active_tab' };
  if (matches.length !== 1) return { ok: false, error: 'ambiguous_active_tab' };
  const sessionId = matches[0].sessionId;
  const result = await exportManagedSession({ registry, sessionId, sendToTab });
  return result.ok ? { ...result, sessionId } : result;
}
