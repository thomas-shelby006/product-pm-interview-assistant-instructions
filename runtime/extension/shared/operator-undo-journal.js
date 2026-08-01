const MAX_ENTRIES = 32;
const DEFAULT_TTL_MS = 5 * 60_000;

export function normalizeUndoJournal(value = []) {
  return (Array.isArray(value) ? value : []).slice(-MAX_ENTRIES).map(item => ({
    id: String(item.id || ''), action: String(item.action || ''), itemId: String(item.itemId || ''),
    before: item.before && typeof item.before === 'object' ? JSON.parse(JSON.stringify(item.before)) : null,
    after: item.after && typeof item.after === 'object' ? JSON.parse(JSON.stringify(item.after)) : null,
    createdAt: Math.max(0, Number(item.createdAt || 0)), expiresAt: Math.max(0, Number(item.expiresAt || 0)),
    usedAt: Math.max(0, Number(item.usedAt || 0))
  })).filter(item => item.id && item.action && item.itemId);
}

export function recordUndo(journal = [], change = {}, now = Date.now(), ttlMs = DEFAULT_TTL_MS) {
  const itemId = String(change.itemId || '');
  const action = String(change.action || 'metadata_change');
  if (!itemId || !change.before || !change.after) return normalizeUndoJournal(journal);
  const entry = {
    id: String(change.id || `${action}:${itemId}:${now}`), action, itemId,
    before: JSON.parse(JSON.stringify(change.before)), after: JSON.parse(JSON.stringify(change.after)),
    createdAt: now, expiresAt: now + Math.max(1, Number(ttlMs) || DEFAULT_TTL_MS), usedAt: 0
  };
  return [...normalizeUndoJournal(journal), entry].slice(-MAX_ENTRIES);
}

export function latestUndo(journal = [], now = Date.now()) {
  return [...normalizeUndoJournal(journal)].reverse().find(item => !item.usedAt && item.expiresAt >= now) || null;
}

export function consumeUndo(journal = [], undoId, now = Date.now()) {
  const values = normalizeUndoJournal(journal);
  const index = values.findIndex(item => item.id === String(undoId || '') && !item.usedAt && item.expiresAt >= now);
  if (index < 0) return { ok: false, error: 'undo_unavailable', journal: values };
  const entry = values[index];
  values[index] = { ...entry, usedAt: now };
  return { ok: true, entry, journal: values };
}
