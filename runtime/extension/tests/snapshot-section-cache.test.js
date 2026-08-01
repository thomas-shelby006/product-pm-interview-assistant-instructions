import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotSectionCache } from '../shared/snapshot-section-cache.js';

test('snapshot cache reuses unchanged section references', () => {
  const cache = new SnapshotSectionCache();
  const first = cache.update({ sender: { phase: 'ready' }, ledger: [{ id: 'q1' }] });
  const second = cache.update({ sender: { phase: 'ready' }, ledger: [{ id: 'q1' }], mode: 'active' });
  assert.equal(first.snapshot.sender, second.snapshot.sender);
  assert.equal(first.snapshot.ledger, second.snapshot.ledger);
  assert.deepEqual(second.reusedKeys.sort(), ['ledger', 'sender']);
  assert.deepEqual(second.changedKeys, ['mode']);
});

test('snapshot cache clones changed sections and isolates caller mutation', () => {
  const cache = new SnapshotSectionCache();
  const source = { sender: { phase: 'ready' } };
  const first = cache.update(source);
  source.sender.phase = 'mutated';
  assert.equal(first.snapshot.sender.phase, 'ready');
  const second = cache.update({ sender: { phase: 'missing' } });
  assert.notEqual(first.snapshot.sender, second.snapshot.sender);
  assert.equal(second.snapshot.sender.phase, 'missing');
});

test('snapshot cache reports removals and reset', () => {
  const cache = new SnapshotSectionCache();
  cache.update({ sender: {}, latestPreview: { revision: 1 } });
  const removed = cache.update({ sender: {} });
  assert.deepEqual(removed.removedKeys, ['latestPreview']);
  assert.equal('latestPreview' in removed.snapshot, false);
  cache.reset();
  const fresh = cache.update({ sender: {} });
  assert.deepEqual(fresh.changedKeys, ['sender']);
  assert.deepEqual(fresh.reusedKeys, []);
});

test('snapshot cache can ignore top-level volatile sections', () => {
  const cache = new SnapshotSectionCache({ volatileKeys: ['now'] });
  const first = cache.update({ sender: { phase: 'ready' }, now: 1 });
  const second = cache.update({ sender: { phase: 'ready' }, now: 2 });
  assert.equal(first.snapshot.sender, second.snapshot.sender);
  assert.deepEqual(second.changedKeys, []);
  assert.equal(second.snapshot.now, 2);
});
