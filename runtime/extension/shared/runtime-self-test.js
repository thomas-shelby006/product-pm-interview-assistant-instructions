function nonceValue() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeFailure(error, fallback) {
  return String(error?.message || error || fallback);
}

async function measured(operation, now) {
  const startedAt = Number(now());
  try {
    const value = await operation();
    return { value, rttMs: Math.max(0, Number(now()) - startedAt) };
  } catch (error) {
    return { value: { ok: false, error: safeFailure(error, 'probe_failed') }, rttMs: Math.max(0, Number(now()) - startedAt) };
  }
}

export async function runRuntimeSelfTest({
  probeRole,
  storageRoundTrip,
  dashboardConnections = 0,
  now = Date.now,
  nonce = nonceValue()
} = {}) {
  if (typeof probeRole !== 'function' || typeof storageRoundTrip !== 'function') {
    throw new TypeError('Runtime self-test requires role and storage probes');
  }
  const startedAt = Number(now());
  const roles = {};
  for (const role of ['sender', 'receiver']) {
    const sample = await measured(() => probeRole(role, nonce), now);
    const value = sample.value || {};
    roles[role] = {
      ok: value.ok === true && value.probe === 'pmia_self_test' && value.role === role,
      rttMs: sample.rttMs,
      error: value.ok === false ? String(value.error || 'probe_rejected') : '',
      composerReady: Boolean(value.composerReady),
      visibilityState: String(value.visibilityState || 'unknown'),
      transport: value.fallback ? 'fallback' : 'direct'
    };
  }
  const storageSample = await measured(() => storageRoundTrip(nonce), now);
  const storageValue = storageSample.value || {};
  const storage = {
    ok: storageValue.ok === true && storageValue.matched === true,
    rttMs: storageSample.rttMs,
    error: storageValue.ok === false ? String(storageValue.error || 'storage_rejected') : ''
  };
  const dashboard = { connected: Number(dashboardConnections) > 0, connections: Math.max(0, Number(dashboardConnections) || 0) };
  const completedAt = Number(now());
  const ok = roles.sender.ok && roles.receiver.ok && storage.ok && dashboard.connected;
  return { ok, startedAt, completedAt, elapsedMs: Math.max(0, completedAt - startedAt), roles, storage, dashboard };
}
