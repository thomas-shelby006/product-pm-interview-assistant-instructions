import test from 'node:test';
import assert from 'node:assert/strict';
import { TransportCircuit } from '../shared/transport-circuit.js';

test('transport circuit opens after consecutive failures and blocks until cooldown', () => {
  let now = 1000;
  const circuit = new TransportCircuit({}, { failureThreshold: 2, cooldownMs: 3000, now: () => now });
  circuit.recordFailure('timeout');
  assert.equal(circuit.snapshot().state, 'closed');
  circuit.recordFailure('timeout');
  assert.equal(circuit.snapshot().state, 'open');
  assert.equal(circuit.canAttemptDirect(), false);
  now = 4000;
  assert.equal(circuit.canAttemptDirect(), true);
  assert.equal(circuit.beginProbe(), true);
  assert.equal(circuit.snapshot().state, 'probing');
});

test('successful transport probe closes circuit and records RTT', () => {
  let now = 1000;
  const circuit = new TransportCircuit({ state: 'open', nextProbeAt: 1000, consecutiveFailures: 2 }, { now: () => now });
  circuit.beginProbe();
  circuit.recordSuccess(37);
  const state = circuit.snapshot();
  assert.equal(state.state, 'closed');
  assert.equal(state.consecutiveFailures, 0);
  assert.equal(state.lastRttMs, 37);
});

test('fresh role connection can force an immediate probe', () => {
  const circuit = new TransportCircuit({ state: 'open', nextProbeAt: 9000, consecutiveFailures: 2 }, { now: () => 1000 });
  assert.equal(circuit.beginProbe(1000, { force: true }), true);
  assert.equal(circuit.snapshot().state, 'probing');
});
