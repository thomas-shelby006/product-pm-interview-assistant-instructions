function roleEvidence(role, now, heartbeatFreshMs, transportFreshMs) {
  if (!role?.connected || role.phase !== 'ready' || !role.composerReady) return false;
  const heartbeatFresh = Number(role.heartbeatAt || 0) > 0 && Number(now) - Number(role.heartbeatAt) <= heartbeatFreshMs;
  const lane = role.transportLane || {};
  const transportFresh = lane.lastMode === 'direct'
    && Number(lane.updatedAt || 0) > 0
    && Number(now) - Number(lane.updatedAt) <= transportFreshMs;
  return heartbeatFresh && transportFresh;
}

export function deriveSelfTestTrust(snapshot, now = Date.now(), {
  activeMs = 30000,
  heartbeatFreshMs = 15000,
  transportFreshMs = 60000,
  maxPulseAgeMs = 300000
} = {}) {
  const value = snapshot?.selfTest || null;
  if (!value) return { state: 'missing', source: 'none', ageMs: 0, expiresAt: 0, detail: 'Active runtime self-test has not run.' };
  const ageMs = value.completedAt ? Math.max(0, Number(now) - Number(value.completedAt)) : Infinity;
  if (value.ok !== true) return { state: 'failed', source: 'active_pulse', ageMs: Number.isFinite(ageMs) ? ageMs : 0, expiresAt: 0, detail: 'The last active runtime self-test failed.' };
  if (ageMs <= activeMs) return { state: 'active', source: 'active_pulse', ageMs, expiresAt: Number(value.completedAt) + activeMs, detail: 'Active no-content pulse is fresh.' };
  const evidenceFresh = ageMs <= maxPulseAgeMs
    && Number(snapshot?.dashboardConnections || 0) > 0
    && roleEvidence(snapshot?.sender, now, heartbeatFreshMs, transportFreshMs)
    && roleEvidence(snapshot?.receiver, now, heartbeatFreshMs, transportFreshMs);
  if (evidenceFresh) {
    const expiresAt = Math.min(
      Number(value.completedAt) + maxPulseAgeMs,
      Number(snapshot.sender.heartbeatAt) + heartbeatFreshMs,
      Number(snapshot.receiver.heartbeatAt) + heartbeatFreshMs,
      Number(snapshot.sender.transportLane.updatedAt) + transportFreshMs,
      Number(snapshot.receiver.transportLane.updatedAt) + transportFreshMs
    );
    return { state: 'evidence_fresh', source: 'role_and_transport_evidence', ageMs, expiresAt, detail: 'The active pulse is extended by fresh role and direct-port evidence.' };
  }
  return { state: 'stale', source: 'active_pulse', ageMs: Number.isFinite(ageMs) ? ageMs : 0, expiresAt: Number(value.completedAt || 0) + activeMs, detail: 'Active verification evidence is stale.' };
}