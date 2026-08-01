import test from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryLedgerIndex } from '../shared/delivery-ledger-index.js';

function entry(id, provider, seq) {
  return { id, envelope: { id, sourceProvider: provider, seq } };
}

test('ledger index provides exact id and provider-sequence lookup', () => {
  const first = entry('a', 'chatgpt', 1);
  const second = entry('b', 'claude', 1);
  const index = new DeliveryLedgerIndex([first, second]);
  assert.equal(index.byId('a'), first);
  assert.equal(index.bySequence('chatgpt', 1), first);
  assert.equal(index.bySequence('claude', 1), second);
});

test('ledger index rejects duplicate identity without changing the original', () => {
  const first = entry('a', 'chatgpt', 1);
  const index = new DeliveryLedgerIndex([first]);
  assert.deepEqual(index.insert(entry('a', 'chatgpt', 2)), { accepted: false, reason: 'duplicate_id', entry: first });
  assert.deepEqual(index.insert(entry('b', 'chatgpt', 1)), { accepted: false, reason: 'duplicate_sequence', entry: first });
  assert.equal(index.byId('b'), null);
});

test('ledger index rebuild and removal preserve current identities', () => {
  const first = entry('a', 'chatgpt', 1);
  const second = entry('b', 'chatgpt', 2);
  const index = new DeliveryLedgerIndex([first, second]);
  assert.equal(index.remove(first), true);
  assert.equal(index.byId('a'), null);
  index.rebuild([first]);
  assert.equal(index.byId('a'), first);
  assert.equal(index.byId('b'), null);
  assert.deepEqual(index.stats(), { ids: 1, sequences: 1, rebuilds: 2 });
});
