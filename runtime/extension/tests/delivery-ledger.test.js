import test from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryLedger } from '../shared/delivery-ledger.js';

function envelope(id, seq, text = `Question ${seq}`) {
  return {
    id,
    sessionId: 's-lossless',
    sourceProvider: 'chatgpt',
    kind: 'question',
    seq,
    text,
    metadata: {},
    createdAt: seq
  };
}

test('delivery ledger preserves every unique sequence without count eviction', () => {
  const ledger = new DeliveryLedger();
  for (let seq = 1; seq <= 250; seq += 1) ledger.persist(envelope(`q-${seq}`, seq));
  assert.equal(ledger.snapshot().length, 250);
  assert.equal(ledger.pending().length, 250);
});

test('delivery ledger deduplicates identity and sequence but permits repeated wording later', () => {
  const ledger = new DeliveryLedger();
  assert.equal(ledger.persist(envelope('q-1', 1, 'Repeat this')).duplicate, false);
  assert.equal(ledger.persist(envelope('q-1', 1, 'Repeat this')).duplicate, true);
  assert.equal(ledger.persist(envelope('other-id', 1, 'Different')).duplicate, true);
  assert.equal(ledger.persist(envelope('q-2', 2, 'Repeat this')).duplicate, false);
  assert.deepEqual(ledger.snapshot().map(item => item.id), ['q-1', 'q-2']);
});

test('delivery ledger retains failed entries and proves all members of one batch', () => {
  const ledger = new DeliveryLedger();
  ledger.persist(envelope('q-1', 1));
  ledger.persist(envelope('q-2', 2));
  ledger.markFailed(['q-1'], 'receiver_missing', 10);
  assert.equal(ledger.get('q-1').state, 'failed');
  ledger.markStaged(['q-1', 'q-2'], 'batch-1', 11);
  ledger.markSubmitting('batch-1', 12);
  const proven = ledger.markProven('batch-1', { proof: 'new_rendered_turn', verified: true }, 13);
  assert.deepEqual(proven.map(item => item.id), ['q-1', 'q-2']);
  assert.equal(ledger.counts().proven, 2);
  assert.equal(ledger.counts().pending, 0);
});

test('delivery ledger compatibility queue never supersedes older finals automatically', () => {
  const ledger = new DeliveryLedger();
  ledger.enqueue(envelope('q-1', 1));
  ledger.enqueue(envelope('q-2', 2));
  assert.deepEqual(ledger.supersedeBefore(2), []);
  assert.deepEqual(ledger.list().map(item => item.id), ['q-1', 'q-2']);
});
