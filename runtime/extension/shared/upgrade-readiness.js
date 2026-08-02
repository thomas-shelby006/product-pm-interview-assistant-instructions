export function deriveUpgradeReadiness(snapshot = {}) {
  const blockers = [];
  const compatibility = snapshot.stateCompatibility || snapshot.stateAudit || {};
  if (compatibility.state === 'blocked' || compatibility.blocked) blockers.push('state_compatibility_blocked');
  if (compatibility.quarantined || compatibility.state === 'quarantined') blockers.push('state_quarantined');
  if (['high','critical'].includes(snapshot.storagePressure?.level)) blockers.push('storage_headroom_low');
  const counts = snapshot.ledgerCounts || {};
  const unresolved = Number(counts.pending || counts.persisted || 0) + Number(counts.failed || 0);
  const inFlight = Number(counts.inFlight || counts.staged || counts.submitted || 0);
  if (unresolved) blockers.push('unresolved_delivery');
  if (inFlight) blockers.push('delivery_in_flight');
  if (snapshot.senderOutboxState?.count) blockers.push('sender_outbox_pending');
  if (snapshot.cleanupTransaction?.state === 'failed') blockers.push('cleanup_recovery_required');
  const rollbackReady = Boolean(snapshot.stateIntegrity?.lastKnownGood || snapshot.stateCompatibility?.lastKnownGood || snapshot.checkpoint);
  if (!rollbackReady) blockers.push('rollback_checkpoint_missing');
  const state = blockers.length ? (blockers.some(code => code.includes('blocked') || code.includes('quarantined')) ? 'blocked' : 'wait') : 'ready';
  return { state, ready: state === 'ready', blockers, unresolved, inFlight, storageLevel: snapshot.storagePressure?.level || 'normal', rollbackReady, schemaVersion: Number(snapshot.stateCompatibility?.schemaVersion || snapshot.stateAudit?.schemaVersion || 0) };
}
