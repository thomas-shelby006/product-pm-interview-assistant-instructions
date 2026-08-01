function generation(value) { return Math.max(0, Number(value?.ownerGeneration) || 0); }
export function electRegistryOwner(existing, incoming, { now = Date.now(), leaseMs = 45000 } = {}) {
  const timestamp = Number(now) || Date.now(); const current = existing && typeof existing === 'object' ? existing : null; const candidate = incoming && typeof incoming === 'object' ? incoming : {};
  const currentExpired = !current || Number(current.leaseExpiresAt || current.registeredAt || 0) <= timestamp;
  const sameInstance = Boolean(current && candidate.instanceId && current.instanceId === candidate.instanceId);
  const requestedGeneration = Math.max(1, generation(candidate) || (sameInstance ? generation(current) : 1));
  const incomingWins = !current || currentExpired || sameInstance || requestedGeneration > generation(current);
  if (!incomingWins) return { winner: 'existing', reason: 'fresh_higher_generation_owner', registration: { ...current } };
  return {
    winner: 'incoming', reason: currentExpired && current ? 'expired_owner_takeover' : sameInstance ? 'owner_lease_renewed' : current ? 'higher_generation_takeover' : 'owner_created',
    registration: { ...candidate, ownerGeneration: Math.max(requestedGeneration, generation(current) + (sameInstance ? 0 : 1)), leaseExpiresAt: timestamp + Math.max(1000, Number(leaseMs) || 45000), registeredAt: timestamp }
  };
}