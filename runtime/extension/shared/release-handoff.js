function gate(id, ok, detail = '') { return { id, ok: Boolean(ok), detail: String(detail || '') }; }
export function deriveReleaseHandoff(snapshot = {}, production = {}, evidence = {}) {
  const gates = [
    gate('source', evidence.sourceClean !== false, evidence.commit || ''),
    gate('automated', evidence.automatedOk === true, evidence.automatedSummary || 'Fresh automated evidence required'),
    gate('browser', evidence.browserOk === true, evidence.browserSummary || 'Fresh isolated-browser evidence required'),
    gate('privacy', production.diagnostics?.privacy?.safe === true, 'Metadata-only diagnostics'),
    gate('cleanup', evidence.cleanupOk === true, evidence.cleanupSummary || 'Cleanup evidence required'),
    gate('runtime', production.diagnostics?.state === 'healthy', `Health ${production.diagnostics?.score || 0}/100`),
    gate('delivery', Number(snapshot.ledgerCounts?.pending || 0) + Number(snapshot.ledgerCounts?.inFlight || 0) === 0, 'No unresolved ownership'),
    gate('push', evidence.noPushMergeTag === true, 'No push, merge, or tag')
  ];
  const failed = gates.filter(item => !item.ok);
  return { state: failed.length ? 'not_ready' : 'ready', ready: failed.length === 0, gates, failed: failed.map(item => item.id), commit: String(evidence.commit || ''), generatedAt: Number(evidence.generatedAt || 0) };
}
export function buildHandoffManifest({ snapshot = {}, production = {}, evidence = {}, files = [] } = {}) {
  const release = deriveReleaseHandoff(snapshot, production, evidence);
  return { schema: 'pmia-handoff/v1', version: String(production.diagnostics?.fingerprint?.version || '0.9.0'), commit: release.commit, ready: release.ready, gates: release.gates, route: production.routeReadiness?.route || '', operatingProfile: production.operatingProfile?.id || 'balanced', cleanupFiles: [...new Set((files || []).map(String))].sort(), generatedAt: release.generatedAt };
}
