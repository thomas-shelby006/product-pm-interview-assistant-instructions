import { canonicalFingerprint } from './canonical-fingerprint.js';

const VOLATILE_FIELDS = ['heartbeatAt', 'sourceSilenceMs'];

export function telemetryFingerprint(value) {
  return canonicalFingerprint(value || {}, { omitKeys: VOLATILE_FIELDS });
}

export function hasMeaningfulTelemetryChange(previous, next) {
  return telemetryFingerprint(previous) !== telemetryFingerprint(next);
}

export function heartbeatPatch(roleState) {
  return {
    heartbeatAt: Number(roleState?.heartbeatAt || Date.now()),
    sourceSilenceMs: Number(roleState?.sourceSilenceMs || 0),
    sourceSilenceState: String(roleState?.sourceSilenceState || ''),
    lastActivityAt: Number(roleState?.lastActivityAt || 0),
    lastSourceActivityAt: Number(roleState?.lastSourceActivityAt || 0)
  };
}
