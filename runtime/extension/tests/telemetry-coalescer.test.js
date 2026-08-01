import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasMeaningfulTelemetryChange,
  heartbeatPatch,
  telemetryFingerprint
} from '../shared/telemetry-coalescer.js';

test('heartbeat-only changes do not require a full pilot commit', () => {
  const before = { phase: 'ready', composerReady: true, heartbeatAt: 1000, sourceSilenceMs: 5000 };
  const after = { phase: 'ready', composerReady: true, heartbeatAt: 6000, sourceSilenceMs: 10000 };
  assert.equal(hasMeaningfulTelemetryChange(before, after), false);
  assert.equal(telemetryFingerprint(before), telemetryFingerprint(after));
});

test('semantic runtime changes still require a full pilot commit', () => {
  assert.equal(hasMeaningfulTelemetryChange(
    { phase: 'ready', composerReady: true },
    { phase: 'ready', composerReady: false }
  ), true);
});

test('lightweight heartbeat patch contains only live age fields', () => {
  assert.deepEqual(heartbeatPatch({
    heartbeatAt: 5000,
    sourceSilenceMs: 2000,
    sourceSilenceState: 'healthy',
    lastActivityAt: 4000,
    lastSourceActivityAt: 3000,
    latestFinal: { text: 'must not copy' }
  }), {
    heartbeatAt: 5000,
    sourceSilenceMs: 2000,
    sourceSilenceState: 'healthy',
    lastActivityAt: 4000,
    lastSourceActivityAt: 3000
  });
});
