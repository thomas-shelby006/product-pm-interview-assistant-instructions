function normalizePrimitive(value) {
  if (value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (typeof value === 'symbol' || typeof value === 'function') return null;
  return value;
}

export function canonicalize(value, { omitKeys = [] } = {}) {
  const omitted = new Set((Array.isArray(omitKeys) ? omitKeys : [omitKeys]).map(String));
  const active = new WeakSet();
  const visit = current => {
    if (!current || typeof current !== 'object') return normalizePrimitive(current);
    if (active.has(current)) throw new TypeError('cyclic_value');
    active.add(current);
    let result;
    if (Array.isArray(current)) {
      result = current.map(visit);
    } else if (current instanceof Date) {
      result = current.toISOString();
    } else {
      result = Object.fromEntries(
        Object.keys(current)
          .filter(key => !omitted.has(key))
          .sort()
          .map(key => [key, visit(current[key])])
      );
    }
    active.delete(current);
    return result;
  };
  return visit(value);
}

export function canonicalFingerprint(value, options = {}) {
  let hash = 0x811c9dc5;
  const serialized = JSON.stringify(canonicalize(value, options));
  for (const character of serialized) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
