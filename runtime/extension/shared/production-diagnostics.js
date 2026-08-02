function boundedFingerprint(snapshot = {}) {
  return { version: String(snapshot.releaseIdentity?.version || snapshot.version || '0.9.0'), sessionId: String(snapshot.sessionId || '').slice(0,64), route: `${snapshot.sender?.provider || '--'}>${snapshot.receiver?.provider || '--'}`, schemaVersion: Number(snapshot.stateCompatibility?.schemaVersion || snapshot.stateAudit?.schemaVersion || 0), senderProtocol: Number(snapshot.sender?.transportLane?.protocolVersion || 0), receiverProtocol: Number(snapshot.receiver?.transportLane?.protocolVersion || 0), senderCapabilities: (snapshot.sender?.adapterCapabilities?.required || []).length, receiverCapabilities: (snapshot.receiver?.adapterCapabilities?.required || []).length };
}
export function deriveProductionDiagnostics(snapshot = {}, production = {}) {
  const factors = [snapshot.selfTest?.ok === true, production.transportAssurance?.state !== 'blocked', production.routeReadiness?.ready === true, production.upgradeReadiness?.state !== 'blocked', snapshot.consistencyAudit?.ok !== false, snapshot.storagePressure?.level !== 'critical'];
  const score = Math.round((factors.filter(Boolean).length / factors.length) * 100);
  const requiredSections = ['decisionCenter','operatingProfile','containment','transportAssurance','routeReadiness','upgradeReadiness','scorecard'];
  const missingSections = requiredSections.filter(key => !production[key]);
  const privacy = { contentFieldsExcluded: true, rawUrlsExcluded: true, clipboardExcluded: true, credentialsExcluded: true, safe: true };
  const fingerprint = boundedFingerprint(snapshot);
  const summary = `PMIA ${fingerprint.version} | ${fingerprint.route} | health ${score}/100 | mode ${snapshot.mode || 'unknown'} | decisions ${production.decisionCenter?.count || 0} | transport ${production.transportAssurance?.state || 'unknown'} | upgrade ${production.upgradeReadiness?.state || 'unknown'}`;
  return { state: score >= 90 ? 'healthy' : score >= 65 ? 'watch' : 'action_required', score, fingerprint, privacy, supportComplete: missingSections.length === 0, missingSections, escalationSummary: summary.slice(0,600) };
}
