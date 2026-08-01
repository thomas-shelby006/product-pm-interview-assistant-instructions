const VOLATILE_FIELDS = new Set(['heartbeatAt', 'sourceSilenceMs']);

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter(key => !VOLATILE_FIELDS.has(key))
      .sort()
      .map(key => [key, stableObject(value[key])])
  );
}

export function telemetryFingerprint(value) {
  return JSON.stringify(stableObject(value || {}));
}

export function hasMeaningfulTelemetryChange(previous, next) {
  return telemetryFingerprint(previous) !== telemetryFingerprint(next);
}

export function heartbeatPatch(roleState) {
  return {
    heartbeatAt: Number(roleState?.heartbeatAt || Date.now()),
    sourceSilenceMs: Number(roleState?.sourceSilenceMs || 0),
    sourceSilenceState: String(roleState?.sourceSilenceState || ''),
    lastActivityAt: Number(roleState?.lastActivityAt || 0),
    lastSourceActivityAt: Number(roleState?.lastSourceActivityAt || 0)
  };
}
