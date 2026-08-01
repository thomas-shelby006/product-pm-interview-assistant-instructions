export function claimRuntimeInjection(current = null, incoming = {}, now = Date.now()) {
  const value = { instanceId: String(incoming.instanceId || ''), generation: Math.max(0, Number(incoming.generation || 0)), createdAt: Math.max(0, Number(incoming.createdAt || now)), documentId: String(incoming.documentId || '') };
  if (!value.instanceId || !value.documentId) return { accepted: false, reason: 'runtime_identity_missing', owner: current };
  if (!current) return { accepted: true, reason: 'runtime_owner_created', owner: value };
  if (current.instanceId === value.instanceId && current.documentId === value.documentId) return { accepted: true, duplicate: true, reason: 'runtime_owner_heartbeat', owner: current };
  if (value.generation > Number(current.generation || 0)) return { accepted: true, reason: 'runtime_generation_takeover', owner: value, displaced: current };
  return { accepted: false, reason: 'runtime_generation_stale', owner: current, rejected: value };
}

export function releaseRuntimeInjection(current = null, identity = {}) {
  if (!current) return { released: false, reason: 'runtime_owner_missing' };
  if (current.instanceId !== String(identity.instanceId || '') || current.documentId !== String(identity.documentId || '')) return { released: false, reason: 'runtime_owner_mismatch', owner: current };
  return { released: true, reason: 'runtime_owner_released', owner: null };
}
