import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeRuntimeEnvelope, normalizeRuntimeEnvelope } from '../shared/runtime-state-schema.js';

test('legacy runtime arrays normalize as schema one envelopes', () => {
  const result = normalizeRuntimeEnvelope([{ sessionId: 's1' }], { writerVersion: '0.7.0', now: 100 });
  assert.equal(result.ok, true);
  assert.equal(result.legacy, true);
  assert.equal(result.envelope.schemaVersion, 1);
  assert.deepEqual(result.envelope.sessions, [{ sessionId: 's1' }]);
});

test('runtime state encodes an immutable schema three envelope', () => {
  const sessions = [{ sessionId: 's1' }];
  const envelope = encodeRuntimeEnvelope(sessions, { writerVersion: '0.7.0', now: 200 });
  sessions[0].sessionId = 'changed';
  assert.deepEqual(envelope, {
    schemaVersion: 3,
    writerVersion: '0.7.0',
    committedAt: 200,
    sessions: [{ sessionId: 's1' }]
  });
});

test('invalid runtime envelope fails closed', () => {
  const result = normalizeRuntimeEnvelope({ schemaVersion: 2, sessions: {} });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_sessions');
});
