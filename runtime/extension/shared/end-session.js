export async function closeOwnedSessionTabs({
  registry,
  sessionId,
  requesterTabId,
  removeTabs
} = {}) {
  if (!registry?.ownsTab?.(sessionId, requesterTabId)) {
    return { ok: false, error: 'session_not_owned' };
  }
  const session = registry.getSession(sessionId);
  const closedTabIds = [...new Set(
    [session?.sender?.tabId, session?.receiver?.tabId]
      .filter(Number.isInteger)
  )];
  if (closedTabIds.length && typeof removeTabs === 'function') {
    await removeTabs(closedTabIds);
  }
  return { ok: true, closedTabIds };
}
