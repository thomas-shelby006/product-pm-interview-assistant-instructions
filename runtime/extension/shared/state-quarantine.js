function clone(value) {
  if (value === undefined) return null;
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).length;
}

export function createStateQuarantine(state, reason = 'runtime_state_blocked', now = Date.now()) {
  const cloned = clone(state);
  return {
    reason: String(reason || 'runtime_state_blocked'),
    capturedAt: Math.max(0, Number(now) || Date.now()),
    schemaVersion: Math.max(0, Number(cloned?.schemaVersion) || 0),
    writerVersion: String(cloned?.writerVersion || ''),
    bytes: byteLength(cloned),
    state: cloned
  };
}

export function preserveStateQuarantine(existing, incoming) {
  if (existing?.state && existing?.reason) return clone(existing);
  return clone(incoming);
}

export function quarantineAudit(value) {
  if (!value?.state) {
    return { present: false, reason: '', capturedAt: 0, schemaVersion: 0, writerVersion: '', bytes: 0 };
  }
  return {
    present: true,
    reason: String(value.reason || ''),
    capturedAt: Math.max(0, Number(value.capturedAt) || 0),
    schemaVersion: Math.max(0, Number(value.schemaVersion) || 0),
    writerVersion: String(value.writerVersion || ''),
    bytes: Math.max(0, Number(value.bytes) || byteLength(value.state))
  };
}

export function selectRecoverableState(current, previous, quarantine) {
  if (current != null) return { ok: true, source: 'current', state: clone(current) };
  if (previous != null) return { ok: true, source: 'previous', state: clone(previous) };
  if (quarantine?.state) {
    return { ok: false, source: 'quarantine', state: null, reason: 'quarantined_state_only' };
  }
  return { ok: true, source: 'empty', state: [], reason: 'state_missing' };
}
