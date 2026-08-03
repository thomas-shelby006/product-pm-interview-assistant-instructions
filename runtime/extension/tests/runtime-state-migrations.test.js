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

test('schema three migration adds a bounded Navigator default', () => {
  const result = migrateRuntimeEnvelope({ schemaVersion: 3, writerVersion: '0.10.0', committedAt: 10, sessions: [{ sessionId: 's1' }] }, 4, { writerVersion: '0.11.0', now: 20 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.applied, ['3->4']);
  assert.equal(result.envelope.schemaVersion, 4);
  assert.equal(result.envelope.sessions[0].sessionNavigator.defaultTab, 'now');
  assert.deepEqual(result.envelope.sessions[0].sessionNavigator.bookmarks, []);
});

test('runtime migration is idempotent at the target schema', () => {
  const envelope = { schemaVersion: 4, writerVersion: '0.11.0', committedAt: 10, sessions: [] };
  const result = migrateRuntimeEnvelope(envelope, 4);
  assert.equal(result.ok, true);
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.envelope, envelope);
});

test('future runtime schema fails closed', () => {
  const result = migrateRuntimeEnvelope({ schemaVersion: 5, sessions: [] }, 4);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'future_schema');
});

test('missing migration step is explicit', () => {
  const result = migrateRuntimeEnvelope({ schemaVersion: 1, sessions: [] }, 6);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing_migration_4_to_5');
});
