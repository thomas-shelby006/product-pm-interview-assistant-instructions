function normalizeIdentity(value = {}, now = Date.now(), leaseMs = 30000) {
  const heartbeatAt = Math.max(0, Number(value.heartbeatAt ?? value.createdAt ?? now));
  return { instanceId:String(value.instanceId || ''), generation:Math.max(0,Number(value.generation || 0)), createdAt:Math.max(0,Number(value.createdAt || now)), heartbeatAt, expiresAt:Math.max(heartbeatAt + Math.max(50,Number(leaseMs)||30000),Number(value.expiresAt || 0)), documentId:String(value.documentId || '') };
}
export function claimRuntimeInjection(current = null, incoming = {}, now = Date.now(), { leaseMs = 30000 } = {}) {
  const value = normalizeIdentity(incoming, now, leaseMs);
  if (!value.instanceId || !value.documentId) return { accepted:false, reason:'runtime_identity_missing', owner:current };
  if (!current) return { accepted:true, reason:'runtime_owner_created', owner:value };
  const owner = normalizeIdentity(current, current.heartbeatAt || current.createdAt || now, leaseMs);
  if (owner.instanceId === value.instanceId && owner.documentId === value.documentId) return { accepted:true, duplicate:true, reason:'runtime_owner_heartbeat', owner:{ ...owner, heartbeatAt:Number(now), expiresAt:Number(now)+Math.max(50,Number(leaseMs)||30000) } };
  const expired = Number(owner.expiresAt || 0) <= Number(now);
  if (value.generation > owner.generation || (expired && value.generation >= owner.generation)) return { accepted:true, reason:expired ? 'runtime_lease_takeover' : 'runtime_generation_takeover', owner:value, displaced:owner };
  return { accepted:false, reason:expired ? 'runtime_generation_regressed' : value.generation === owner.generation ? 'runtime_owner_healthy' : 'runtime_generation_stale', owner, rejected:value };
}
export function releaseRuntimeInjection(current = null, identity = {}) {
  if (!current) return { released:false, reason:'runtime_owner_missing' };
  if (current.instanceId !== String(identity.instanceId || '') || current.documentId !== String(identity.documentId || '')) return { released:false, reason:'runtime_owner_mismatch', owner:current };
  if (identity.generation != null && Number(identity.generation) !== Number(current.generation || 0)) return { released:false, reason:'runtime_generation_mismatch', owner:current };
  return { released:true, reason:'runtime_owner_released', owner:null };
}
