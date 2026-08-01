const VOLATILE_KEYS = new Set(['now', 'uptimeMs']);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function comparable(value) {
  return JSON.stringify(value);
}

export function buildSnapshotDelta(previous, next) {
  if (!previous || !next) return { full: clone(next), changed: {}, removed: [], keys: [], empty: false };
  const changed = {};
  const removed = [];
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    if (VOLATILE_KEYS.has(key)) continue;
    if (!(key in next)) {
      removed.push(key);
      continue;
    }
    if (comparable(previous[key]) !== comparable(next[key])) changed[key] = clone(next[key]);
  }
  const changedKeys = [...Object.keys(changed), ...removed];
  return { changed, removed, keys: changedKeys, empty: changedKeys.length === 0 };
}

export function applySnapshotDelta(current, delta) {
  if (delta?.full) return clone(delta.full);
  const next = { ...(current || {}) };
  for (const key of Array.isArray(delta?.removed) ? delta.removed : []) delete next[key];
  for (const [key, value] of Object.entries(delta?.changed || {})) next[key] = clone(value);
  return next;
}
