export const TRANSPORT_PROTOCOL_VERSION = 1;
export const TRANSPORT_PROTOCOL_MIN_VERSION = 1;
export const DEFAULT_TRANSPORT_CAPABILITIES = Object.freeze([
  'request_response',
  'epoch_fencing',
  'correlation_journal',
  'selective_feedback',
  'receiver_credits',
  'trace_context'
]);

function positiveInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

export function normalizeTransportCapabilities(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map(item => String(item || '').trim())
    .filter(Boolean))].sort();
}

export function createTransportIdentity({
  sessionId,
  role,
  instanceId,
  epoch = 0,
  version = TRANSPORT_PROTOCOL_VERSION,
  capabilities = DEFAULT_TRANSPORT_CAPABILITIES
} = {}) {
  return {
    version: positiveInteger(version, TRANSPORT_PROTOCOL_VERSION),
    sessionId: String(sessionId || ''),
    role: String(role || ''),
    instanceId: String(instanceId || ''),
    epoch: positiveInteger(epoch, 0),
    capabilities: normalizeTransportCapabilities(capabilities)
  };
}

export function createTransportHandshake({
  sessionId,
  role,
  instanceId,
  minVersion = TRANSPORT_PROTOCOL_MIN_VERSION,
  maxVersion = TRANSPORT_PROTOCOL_VERSION,
  capabilities = DEFAULT_TRANSPORT_CAPABILITIES
} = {}) {
  return {
    type: 'transport_handshake',
    sessionId: String(sessionId || ''),
    role: String(role || ''),
    instanceId: String(instanceId || ''),
    minVersion: positiveInteger(minVersion, TRANSPORT_PROTOCOL_MIN_VERSION),
    maxVersion: positiveInteger(maxVersion, TRANSPORT_PROTOCOL_VERSION),
    capabilities: normalizeTransportCapabilities(capabilities)
  };
}

function sameHandshakeIdentity(left, right) {
  return Boolean(
    left?.sessionId && left.sessionId === right?.sessionId
    && left?.role && left.role === right?.role
    && left?.instanceId && left.instanceId === right?.instanceId
  );
}

export function negotiateTransportHandshake(local, remote, { epoch = 0 } = {}) {
  if (!sameHandshakeIdentity(local, remote)) {
    return { ok: false, error: 'transport_identity_mismatch' };
  }
  const low = Math.max(
    positiveInteger(local?.minVersion, TRANSPORT_PROTOCOL_MIN_VERSION),
    positiveInteger(remote?.minVersion, TRANSPORT_PROTOCOL_MIN_VERSION)
  );
  const high = Math.min(
    positiveInteger(local?.maxVersion, TRANSPORT_PROTOCOL_VERSION),
    positiveInteger(remote?.maxVersion, TRANSPORT_PROTOCOL_VERSION)
  );
  if (low > high || high < TRANSPORT_PROTOCOL_MIN_VERSION) {
    return { ok: false, error: 'protocol_version_incompatible' };
  }
  const localCapabilities = new Set(normalizeTransportCapabilities(local?.capabilities));
  const capabilities = normalizeTransportCapabilities(remote?.capabilities)
    .filter(item => localCapabilities.has(item));
  const version = high;
  return {
    ok: true,
    version,
    capabilities,
    identity: createTransportIdentity({
      sessionId: local.sessionId,
      role: local.role,
      instanceId: local.instanceId,
      epoch,
      version,
      capabilities
    })
  };
}

export function validateTransportFrame(frame, expectedIdentity) {
  const protocol = frame?.protocol;
  if (!protocol || typeof protocol !== 'object') {
    return { ok: false, error: 'transport_protocol_missing' };
  }
  if (Number(protocol.version) !== Number(expectedIdentity?.version)) {
    return { ok: false, error: 'protocol_version_mismatch' };
  }
  if (
    String(protocol.sessionId || '') !== String(expectedIdentity?.sessionId || '')
    || String(protocol.role || '') !== String(expectedIdentity?.role || '')
    || String(protocol.instanceId || '') !== String(expectedIdentity?.instanceId || '')
  ) {
    return { ok: false, error: 'transport_identity_mismatch' };
  }
  if (Number(protocol.epoch) !== Number(expectedIdentity?.epoch)) {
    return { ok: false, error: 'stale_transport_epoch' };
  }
  return { ok: true, identity: createTransportIdentity(protocol) };
}

export function withTransportProtocol(frame, identity) {
  return { ...frame, protocol: createTransportIdentity(identity) };
}