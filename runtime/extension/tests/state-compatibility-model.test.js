import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveStateCompatibility } from '../dashboard/state-compatibility-model.js';

test('state compatibility reports a verified current schema', () => {
  const value = deriveStateCompatibility({ stateAudit: {
    blocked: 0,
    recovered: false,
    schema: { version: 2, writerVersion: '0.7.0', migration: [] },
    integrity: { state: 'verified', reason: 'digest_verified' },
    quarantine: { present: false }
  } });
  assert.equal(value.state, 'compatible');
  assert.equal(value.nextAction, 'none');
  assert.equal(value.schemaPath, '2');
});

test('state compatibility distinguishes migrated and recovered state', () => {
  const migrated = deriveStateCompatibility({ stateAudit: {
    blocked: 0,
    recovered: false,
    schema: { version: 2, migration: ['1->2'] },
    integrity: { state: 'sealed', reason: 'digest_missing' }
  } });
  assert.equal(migrated.state, 'migrated');
  assert.equal(migrated.schemaPath, '1->2');
  const recovered = deriveStateCompatibility({ stateAudit: {
    blocked: 0,
    recovered: true,
    recoveryReason: 'digest_mismatch',
    schema: { version: 2, migration: [] },
    integrity: { state: 'recovered', reason: 'digest_mismatch' }
  } });
  assert.equal(recovered.state, 'recovered');
  assert.equal(recovered.nextAction, 'review_recovery');
});

test('state compatibility blocks future and corrupt state with one action', () => {
  const future = deriveStateCompatibility({ stateAudit: {
    blocked: 1,
    findings: [{ code: 'future_schema' }],
    schema: { version: 3 },
    quarantine: { present: true, reason: 'future_schema' }
  } });
  assert.equal(future.state, 'blocked');
  assert.equal(future.nextAction, 'upgrade_extension');
  const corrupt = deriveStateCompatibility({ stateAudit: {
    blocked: 1,
    findings: [{ code: 'digest_mismatch' }],
    integrity: { state: 'blocked', reason: 'digest_mismatch' },
    quarantine: { present: true, reason: 'digest_mismatch' }
  } });
  assert.equal(corrupt.nextAction, 'export_and_repair');
  assert.doesNotMatch(JSON.stringify(corrupt), /sessionId|sessions|secret/);
});
