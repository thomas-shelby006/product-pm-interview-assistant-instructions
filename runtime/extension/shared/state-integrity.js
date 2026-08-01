function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter(key => key !== 'integrityDigest')
      .sort()
      .map(key => [key, canonicalize(value[key])])
  );
}

function clone(value) {
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

export function digestRuntimeEnvelope(envelope) {
  let hash = 0x811c9dc5;
  for (const character of JSON.stringify(canonicalize(envelope))) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function sealRuntimeEnvelope(envelope) {
  const next = clone(envelope);
  next.integrityDigest = digestRuntimeEnvelope(next);
  return next;
}

export function verifyRuntimeEnvelope(envelope) {
  const expected = String(envelope?.integrityDigest || '');
  const actual = digestRuntimeEnvelope(envelope);
  if (!expected) return { ok: false, reason: 'digest_missing', expected, actual };
  if (expected !== actual) return { ok: false, reason: 'digest_mismatch', expected, actual };
  return { ok: true, reason: 'digest_verified', expected, actual };
}
