import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalFingerprint, canonicalize } from '../shared/canonical-fingerprint.js';

test('canonical fingerprint is independent of object key order', () => {
  assert.equal(
    canonicalFingerprint({ b: 2, a: { y: 2, x: 1 } }),
    canonicalFingerprint({ a: { x: 1, y: 2 }, b: 2 })
  );
});

test('canonical fingerprint omits configured volatile keys recursively', () => {
  const before = { now: 1, nested: { heartbeatAt: 2, state: 'ready' } };
  const after = { now: 99, nested: { heartbeatAt: 88, state: 'ready' } };
  assert.equal(
    canonicalFingerprint(before, { omitKeys: ['now', 'heartbeatAt'] }),
    canonicalFingerprint(after, { omitKeys: ['now', 'heartbeatAt'] })
  );
});

test('canonical fingerprint preserves array order and Unicode', () => {
  assert.notEqual(canonicalFingerprint(['α', 'β']), canonicalFingerprint(['β', 'α']));
  assert.deepEqual(canonicalize({ value: 'தமிழ்' }), { value: 'தமிழ்' });
});

test('canonical traversal rejects cyclic values explicitly', () => {
  const value = {};
  value.self = value;
  assert.throws(() => canonicalize(value), /cyclic_value/);
});
