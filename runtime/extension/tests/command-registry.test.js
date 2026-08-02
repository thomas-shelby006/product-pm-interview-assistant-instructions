import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMAND_REGISTRY, auditCommandRegistry, commandDefinition, commandRegistryDigestSource, registeredCommandIds } from '../shared/operator-command-registry.js';
import { DASHBOARD_COMMANDS, normalizeDashboardCommand } from '../shared/dashboard-protocol.js';

test('PMIA command registry is deterministic unique and valid', () => {
  const audit = auditCommandRegistry();
  assert.equal(audit.ok, true);
  assert.equal(audit.count, new Set(registeredCommandIds()).size);
  assert.equal(COMMAND_REGISTRY[0].id, 'pause');
  assert.match(commandRegistryDigestSource(), /compact_proven/);
});

test('dead Pilot controls are registered and protocol-routable', () => {
  for (const id of ['compact_proven','retry_outbox']) {
    assert.equal(commandDefinition(id)?.owner, 'runtime_pilot_controller');
    assert.equal(DASHBOARD_COMMANDS.has(id), true);
    assert.equal(normalizeDashboardCommand({ sessionId:'s1', requestId:`r-${id}`, command:id })?.command, id);
  }
});

test('registry rejects unknown commands without coercion', () => {
  assert.equal(commandDefinition('missing'), null);
  assert.equal(normalizeDashboardCommand({ sessionId:'s1', requestId:'r1', command:'missing' }), null);
});