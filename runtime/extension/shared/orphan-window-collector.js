export function collectOrphanManagedWindows({ sessions = [], windows = [], now = Date.now(), staleAfterMs = 120000 } = {}) {
  const owned = new Set();
  for (const session of Array.isArray(sessions) ? sessions : []) for (const role of ['sender','receiver','pilot']) {
    const id = session?.[role]?.windowId || session?.layout?.windows?.[role]?.windowId;
    if (id !== undefined && id !== null) owned.add(String(id));
  }
  const orphans = [];
  for (const window of Array.isArray(windows) ? windows : []) {
    const title = String(window.title || '');
    if (!/^PMIA_(SENDER|RECEIVER|DASHBOARD)_/.test(title)) continue;
    if (owned.has(String(window.id))) continue;
    const ageMs = Math.max(0, now - Number(window.lastSeenAt ?? window.createdAt ?? now));
    if (ageMs < staleAfterMs) continue;
    orphans.push({ windowId: window.id, title, ageMs, reason: 'unowned_managed_window' });
  }
  return { orphans, count: orphans.length, actions: orphans.map(item => ({ type: 'close_orphan_window', windowId: item.windowId })) };
}
