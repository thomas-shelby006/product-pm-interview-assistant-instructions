import test from 'node:test';
import assert from 'node:assert/strict';
import { runTransportDrill } from '../shared/transport-drill.js';

test('transport drill covers all no-content control-plane checks', async () => {
  const calls = [];
  const result = await runTransportDrill({
    handshake: async () => ({ ok: true, roles: ['sender', 'receiver'] }),
    direct: async () => ({ ok: true, rttMs: 5 }),
    fallback: async () => ({ ok: true, rttMs: 8 }),
    reconnect: async () => ({ ok: true, epochAdvanced: true }),
    selectiveNack: async () => ({ ok: true, nackRanges: [[2, 2]] }),
    alarmAudit: async () => ({ ok: true, restored: 0 }),
    invariantAudit: async () => ({ ok: true, blocked: 0 }),
    stateCompatibility: async () => ({ ok: true, state: 'compatible' }),
    indexAudit: async () => ({ ok: true, mismatches: 0 }),
    capabilityProbation: async () => ({ ok: true, roles: [] }),
    queueOnlyPolicy: async () => ({ ok: true, active: false }),
    restartContinuity: async () => ({ ok: true, ownerCount: 2 }),
    onCheck: check => calls.push(check.name),
    now: (() => { let value = 0; return () => ++value; })()
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    'handshake', 'direct', 'fallback', 'reconnect', 'selective_nack', 'alarm_audit',
    'invariant_audit', 'state_compatibility', 'index_audit', 'capability_probation',
    'queue_only_policy', 'restart_continuity'
  ]);
  assert.equal(result.contentAccessed, false);
});

test('transport drill reports failed check without mutating delivery data', async () => {
  const result = await runTransportDrill({
    handshake: async () => ({ ok: false, error: 'handshake_missing' })
  });
  assert.equal(result.ok, false);
  assert.equal(result.checks[0].error, 'handshake_missing');
  assert.equal(result.contentAccessed, false);
});