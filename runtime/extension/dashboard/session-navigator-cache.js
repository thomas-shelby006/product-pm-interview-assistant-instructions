const SEMANTIC_KEYS = new Set([
  'ledger', 'ledgerCounts', 'questionOperations', 'operatorMarkers',
  'incidents', 'sessionNavigator', 'timeline'
]);

function fallbackRevision(snapshot = {}) {
  const ledger = Array.isArray(snapshot.ledger) ? snapshot.ledger : [];
  const markers = Array.isArray(snapshot.operatorMarkers) ? snapshot.operatorMarkers : [];
  const incidents = Array.isArray(snapshot.incidents?.items) ? snapshot.incidents.items : [];
  const navigator = snapshot.sessionNavigator || {};
  return [
    String(snapshot.sessionId || ''),
    ledger.length, String(ledger.at(-1)?.id || ''), String(ledger.at(-1)?.state || ''),
    markers.length, String(markers.at(-1)?.id || ''), incidents.length,
    navigator.history?.length || 0, navigator.bookmarks?.length || 0,
    navigator.goals?.length || 0, navigator.workspaces?.length || 0
  ].join(':');
}

export function navigatorDeltaAffectsSemantics(keys = []) {
  return (Array.isArray(keys) ? keys : []).some(key => SEMANTIC_KEYS.has(String(key)));
}
export function createSessionNavigatorCache(builder) {
  if (typeof builder !== 'function') throw new TypeError('Navigator cache requires a builder');
  let key = '';
  let base = null;
  let hits = 0;
  let misses = 0;

  function ensureBase(snapshot, local, now, revision) {
    const next = revision === undefined || revision === null
      ? fallbackRevision(snapshot)
      : `${String(snapshot?.sessionId || '')}:${String(revision)}`;
    if (next !== key || !base) {
      key = next;
      base = builder(snapshot, { ...local, query:'', selectedIndex:0, selectedEntityId:'' }, now);
      misses += 1;
    } else {
      hits += 1;
    }
    return base;
  }

  return {
    get(snapshot = {}, local = {}, now = Date.now(), revision) {
      const cached = ensureBase(snapshot, local, now, revision);
      return builder(snapshot, local, now, { base:cached });
    },
    base(snapshot = {}, now = Date.now(), revision) {
      return ensureBase(snapshot, {}, now, revision);
    },
    invalidate() { key = ''; base = null; },
    stats() { return { hits, misses, ready:Boolean(base), keyLength:key.length }; }
  };
}

export function navigatorSemanticFingerprint(snapshot = {}) {
  return fallbackRevision(snapshot);
}
