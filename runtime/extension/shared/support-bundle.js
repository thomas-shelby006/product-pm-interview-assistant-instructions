function clean(value, max = 160) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}
function role(value = {}) {
  return {
    provider: clean(value.provider, 32),
    phase: clean(value.phase, 48),
    connected: Boolean(value.connected),
    composerReady: Boolean(value.composerReady),
    heartbeatAt: Math.max(0, Number(value.heartbeatAt) || 0),
    instanceId: clean(value.instanceId, 96),
    transport: {
      state: clean(value.transportLane?.state, 40),
      mode: clean(value.transportLane?.lastMode, 40),
      preferredMode: clean(value.transportLane?.preferredMode, 40),
      score: Math.max(0, Number(value.transportLane?.score) || 0),
      rttMs: Math.max(0, Number(value.transportLane?.lastRttMs) || 0),
      protocolVersion: Math.max(0, Number(value.transportLane?.protocolVersion) || 0),
      epoch: Math.max(0, Number(value.transportLane?.epoch) || 0),
      handshakeReady: Boolean(value.transportLane?.handshakeReady)
    },
    capabilityProbation: {
      state: clean(value.adapterCapabilityProbation?.state, 40),
      writeSafe: value.adapterCapabilityProbation?.writeSafe !== false,
      criticalSamples: Math.max(0, Number(value.adapterCapabilityProbation?.criticalSamples) || 0),
      healthySamples: Math.max(0, Number(value.adapterCapabilityProbation?.healthySamples) || 0),
      reason: clean(value.adapterCapabilityProbation?.reason, 120)
    }
  };
}
function safeCodes(values = []) {
  return values.map(item => ({ code: clean(item?.code, 80), role: clean(item?.role, 20) })).filter(item => item.code);
}
export function buildSafeSupportBundle(snapshot = {}, { manifest = {}, sourceHashes = {} } = {}) {
  const ledger = Array.isArray(snapshot.ledger) ? snapshot.ledger : [];
  return {
    format: 'pmia-safe-support-v1',
    generatedAt: Date.now(),
    runtime: { name: clean(manifest.name, 100), version: clean(manifest.version, 32), sessionId: clean(snapshot.sessionId, 128), mode: clean(snapshot.mode, 32) },
    compatibility: {
      state: clean(snapshot.stateCompatibility?.state || snapshot.stateAudit?.compatibility, 48),
      schemaVersion: Math.max(0, Number(snapshot.stateCompatibility?.schemaVersion || snapshot.stateAudit?.schemaVersion) || 0),
      integrity: clean(snapshot.stateCompatibility?.integrity || snapshot.stateAudit?.integrity, 48),
      migration: clean(snapshot.stateCompatibility?.migration || snapshot.stateAudit?.migration, 80)
    },
    rootCause: snapshot.rootCause ? {
      owner: clean(snapshot.rootCause.owner, 40), code: clean(snapshot.rootCause.code, 80), severity: clean(snapshot.rootCause.severity, 20), nextAction: clean(snapshot.rootCause.nextAction, 80),
      suppressed: (snapshot.rootCause.suppressed || []).map(item => ({ owner: clean(item.owner, 40), code: clean(item.code, 80), severity: clean(item.severity, 20) }))
    } : null,
    deliveryPolicy: {
      active: Boolean(snapshot.deliveryPolicy?.active), reason: clean(snapshot.deliveryPolicy?.reason, 80), resumeWhen: clean(snapshot.deliveryPolicy?.resumeWhen, 120), allowPersist: snapshot.deliveryPolicy?.allowPersist !== false, allowProviderWrite: snapshot.deliveryPolicy?.allowProviderWrite !== false
    },
    roles: { sender: role(snapshot.sender), receiver: role(snapshot.receiver) },
    ledger: {
      counts: { ...(snapshot.ledgerCounts || {}) },
      traces: ledger.map(item => ({ id: clean(item.id, 128), seq: Math.max(0, Number(item.envelope?.seq) || 0), state: clean(item.state, 32), batchId: clean(item.batchId, 128), traceId: clean(item.envelope?.metadata?.traceId, 128) }))
    },
    audits: {
      state: { blocked: Math.max(0, Number(snapshot.stateAudit?.blocked) || 0), repaired: Math.max(0, Number(snapshot.stateAudit?.repaired) || 0), digest: clean(snapshot.stateAudit?.digest, 32) },
      consistency: snapshot.consistencyAudit ? { ok: snapshot.consistencyAudit.ok === true, reason: clean(snapshot.consistencyAudit.reason, 80), repairs: safeCodes(snapshot.consistencyAudit.repairs), blocked: safeCodes(snapshot.consistencyAudit.blocked) } : null
    },
    performance: snapshot.performanceBudget ? JSON.parse(JSON.stringify(snapshot.performanceBudget)) : null,
    liveUx: {
      budget: snapshot.liveUxBudget ? JSON.parse(JSON.stringify(snapshot.liveUxBudget)) : null,
      integrity: snapshot.liveCommandIntegrity ? { ok: snapshot.liveCommandIntegrity.ok === true, state: clean(snapshot.liveCommandIntegrity.state, 40), issues: safeCodes(snapshot.liveCommandIntegrity.issues) } : null,
      restart: snapshot.restartContinuity ? JSON.parse(JSON.stringify(snapshot.restartContinuity)) : null,
      accessibility: snapshot.accessibilityProof ? JSON.parse(JSON.stringify(snapshot.accessibilityProof)) : null
    },
    drill: snapshot.lastTransportDrill ? { ok: snapshot.lastTransportDrill.ok === true, elapsedMs: Math.max(0, Number(snapshot.lastTransportDrill.elapsedMs) || 0), contentAccessed: snapshot.lastTransportDrill.contentAccessed === true, checks: (snapshot.lastTransportDrill.checks || []).map(check => ({ name: clean(check.name, 80), ok: check.ok === true, error: clean(check.error, 120), durationMs: Math.max(0, Number(check.durationMs) || 0) })) } : null,
    sourceHashes: Object.fromEntries(Object.entries(sourceHashes || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [clean(key, 200), clean(value, 128)]))
  };
}
