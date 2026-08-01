import test from 'node:test';
import assert from 'node:assert/strict';
import { applySnapshotDelta, buildSnapshotDelta } from '../shared/snapshot-delta.js';

test('snapshot delta round-trips semantic top-level changes', () => {
  const before = { sessionId: 's1', sender: { phase: 'ready' }, ledger: [], now: 1 };
  const after = { sessionId: 's1', sender: { phase: 'ready' }, ledger: [{ id: 'q1' }], mode: 'active', now: 2 };
  const delta = buildSnapshotDelta(before, after);
  assert.deepEqual(delta.keys.sort(), ['ledger', 'mode']);
  assert.deepEqual(applySnapshotDelta(before, delta), { ...after, now: 1 });
});

test('heartbeat-equivalent volatile timestamps do not create a semantic delta', () => {
  const delta = buildSnapshotDelta({ sessionId: 's1', now: 1, uptimeMs: 10 }, { sessionId: 's1', now: 2, uptimeMs: 20 });
  assert.equal(delta.empty, true);
});

test('delta removes keys that no longer exist', () => {
  const delta = buildSnapshotDelta({ sessionId: 's1', latestPreview: { text: 'x' } }, { sessionId: 's1' });
  assert.deepEqual(delta.removed, ['latestPreview']);
  assert.equal('latestPreview' in applySnapshotDelta({ sessionId: 's1', latestPreview: {} }, delta), false);
});
