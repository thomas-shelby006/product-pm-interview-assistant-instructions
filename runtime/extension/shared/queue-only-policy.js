const BLOCKING_ROOT_CAUSES = new Set([
  'state_compatibility',
  'storage_critical',
  'provider_capability_blocked',
  'registration_missing'
]);

export function deriveQueueOnlyPolicy(snapshot = {}, rootCause = {}) {
  const code = String(rootCause.code || '');
  const blocked = BLOCKING_ROOT_CAUSES.has(code);
  const active = blocked;
  const reason = blocked ? code : '';
  const healthyCapabilities = ['sender', 'receiver'].every(
    role => snapshot?.[role]?.adapterCapabilityProbation?.writeSafe !== false
  );
  const compatible = snapshot.stateCompatibility?.state !== 'blocked' && !snapshot.stateAudit?.blocked;
  return {
    active,
    reason,
    resumeWhen: active
      ? (compatible && healthyCapabilities ? 'operator_or_reconcile' : 'compatibility_and_capabilities_healthy')
      : 'already_active',
    allowPersist: true,
    allowProviderWrite: !active,
    evaluatedAt: Number(snapshot.now || snapshot.updatedAt || 0)
  };
}
