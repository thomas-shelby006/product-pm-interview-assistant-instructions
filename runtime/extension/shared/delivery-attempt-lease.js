function safeOwner(value) {
  return String(value || '').trim();
}

export function normalizeAttemptLease(value) {
  if (!value || typeof value !== 'object') return null;
  const owner = safeOwner(value.owner);
  const acquiredAt = Math.max(0, Number(value.acquiredAt) || 0);
  const expiresAt = Math.max(acquiredAt, Number(value.expiresAt) || 0);
  if (!owner || !expiresAt) return null;
  return {
    id: String(value.id || `${owner}:${acquiredAt}`),
    owner,
    reason: String(value.reason || 'delivery_attempt'),
    acquiredAt,
    expiresAt,
    takeoverCount: Math.max(0, Number(value.takeoverCount) || 0)
  };
}

export function isAttemptLeaseActive(value, now = Date.now()) {
  const lease = normalizeAttemptLease(value);
  return Boolean(lease && lease.expiresAt > Number(now));
}

export function acquireAttemptLease(current, {
  owner,
  reason = 'delivery_attempt',
  now = Date.now(),
  ttlMs = 5000,
  leaseId = ''
} = {}) {
  const requestedOwner = safeOwner(owner);
  if (!requestedOwner) return { accepted: false, reason: 'attempt_owner_missing', lease: normalizeAttemptLease(current) };
  const existing = normalizeAttemptLease(current);
  const timestamp = Number(now) || Date.now();
  if (existing && existing.expiresAt > timestamp && existing.owner !== requestedOwner) {
    return { accepted: false, reason: 'attempt_lease_held', lease: existing };
  }
  if (existing && existing.expiresAt > timestamp && existing.owner === requestedOwner) {
    return { accepted: true, duplicate: true, reason: 'attempt_lease_reused', lease: existing };
  }
  const takeover = Boolean(existing);
  const lease = {
    id: String(leaseId || `${requestedOwner}:${timestamp}:${Math.random().toString(36).slice(2, 8)}`),
    owner: requestedOwner,
    reason: String(reason || 'delivery_attempt'),
    acquiredAt: timestamp,
    expiresAt: timestamp + Math.max(1, Number(ttlMs) || 5000),
    takeoverCount: Math.max(0, Number(existing?.takeoverCount) || 0) + (takeover ? 1 : 0)
  };
  return { accepted: true, duplicate: false, reason: takeover ? 'attempt_lease_takeover' : 'attempt_lease_acquired', lease };
}

export function releaseAttemptLease(current, { owner = '', leaseId = '' } = {}) {
  const existing = normalizeAttemptLease(current);
  if (!existing) return { released: true, reason: 'attempt_lease_empty', lease: null };
  if (leaseId && existing.id !== String(leaseId)) return { released: false, reason: 'attempt_lease_id_mismatch', lease: existing };
  if (owner && existing.owner !== safeOwner(owner)) return { released: false, reason: 'attempt_lease_owner_mismatch', lease: existing };
  return { released: true, reason: 'attempt_lease_released', lease: null };
}