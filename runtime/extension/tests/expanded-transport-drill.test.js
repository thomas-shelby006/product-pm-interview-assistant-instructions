import test from 'node:test';
import assert from 'node:assert/strict';
import { runTransportDrill } from '../shared/transport-drill.js';

const names = ['handshake','direct','fallback','reconnect','selectiveNack','alarmAudit','invariantAudit','stateCompatibility','indexAudit','capabilityProbation','queueOnlyPolicy','restartContinuity'];

test('expanded transport drill executes twelve no-content checks in deterministic order', async () => {
  const operations = Object.fromEntries(names.map(name => [name, async () => ({ ok: true })]));
  const result = await runTransportDrill(operations);
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 12);
  assert.equal(result.contentAccessed, false);
  assert.deepEqual(result.checks.map(check => check.name), ['handshake','direct','fallback','reconnect','selective_nack','alarm_audit','invariant_audit','state_compatibility','index_audit','capability_probation','queue_only_policy','restart_continuity']);
});
