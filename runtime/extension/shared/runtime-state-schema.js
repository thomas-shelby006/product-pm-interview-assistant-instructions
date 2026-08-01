export const RUNTIME_STATE_SCHEMA_VERSION = 2;

function clone(value) {
  if (value === undefined) return undefined;
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

export function encodeRuntimeEnvelope(sessions = [], {
  writerVersion = '',
  now = Date.now(),
  schemaVersion = RUNTIME_STATE_SCHEMA_VERSION
} = {}) {
  if (!Array.isArray(sessions)) throw new TypeError('Runtime state sessions must be an array');
  return {
    schemaVersion: Math.max(1, Number(schemaVersion) || RUNTIME_STATE_SCHEMA_VERSION),
    writerVersion: String(writerVersion || ''),
    committedAt: Math.max(0, Number(now) || Date.now()),
    sessions: clone(sessions)
  };
}

export function normalizeRuntimeEnvelope(value, metadata = {}) {
  if (Array.isArray(value)) {
    return {
      ok: true,
      legacy: true,
      reason: 'legacy_array',
      envelope: encodeRuntimeEnvelope(value, {
        writerVersion: metadata.writerVersion,
        now: metadata.now,
        schemaVersion: 1
      })
    };
  }
  if (!value || typeof value !== 'object') {
    return { ok: false, legacy: false, reason: 'invalid_envelope', envelope: null };
  }
  if (!Array.isArray(value.sessions)) {
    return { ok: false, legacy: false, reason: 'invalid_sessions', envelope: null };
  }
  const schemaVersion = Math.max(0, Number(value.schemaVersion) || 0);
  if (!schemaVersion) return { ok: false, legacy: false, reason: 'invalid_schema_version', envelope: null };
  return {
    ok: true,
    legacy: schemaVersion === 1,
    reason: 'normalized',
    envelope: {
      ...clone(value),
      schemaVersion,
      writerVersion: String(value.writerVersion || ''),
      committedAt: Math.max(0, Number(value.committedAt) || 0),
      sessions: clone(value.sessions)
    }
  };
}
