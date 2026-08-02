import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateRuntimeEnvelope } from '../shared/runtime-state-migrations.js';

test('runtime migration upgrades schema one to schema two exactly once', () => {
  const result = migrateRuntimeEnvelope({ schemaVersion: 1, writerVersion: '0.6.1', committedAt: 10, sessions: [{ sessionId: 's1' }] }, 2, { writerVersion: '0.7.0', now: 20 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.applied, ['1->2']);
  assert.equal(result.envelope.schemaVersion, 2);
  assert.equal(result.envelope.writerVersion, '0.7.0');
  assert.deepEqual(result.envelope.sessions, [{ sessionId: 's1' }]);
});

test('runtime migration is idempotent at the target schema', () => {
  const envelope = { schemaVersion: 3, writerVersion: '0.9.0', committedAt: 10, sessions: [] };
  const result = migrateRuntimeEnvelope(envelope, 3);
  assert.equal(result.ok, true);
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.envelope, envelope);
});

test('future runtime schema fails closed', () => {
  const result = migrateRuntimeEnvelope({ schemaVersion: 4, sessions: [] }, 3);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'future_schema');
});

test('missing migration step is explicit', () => {
  const result = migrateRuntimeEnvelope({ schemaVersion: 1, sessions: [] }, 5);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing_migration_3_to_4');
});
