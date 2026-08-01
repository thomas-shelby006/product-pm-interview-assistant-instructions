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
  const proven = ledger.markProven('batch-1', { proof: 'new_rendered_turn', verified: true, memberIds: ['q-1', 'q-2'] }, 13);
  assert.deepEqual(proven.map(item => item.id), ['q-1', 'q-2']);
  assert.equal(ledger.counts().proven, 2);
  assert.equal(ledger.counts().pending, 0);
});

test('delivery ledger never supersedes an older unresolved final after a newer proof', () => {
  const ledger = new DeliveryLedger();
  ledger.persist(envelope('q-1', 1));
  ledger.persist(envelope('q-2', 2));
  ledger.markStaged(['q-2'], 'batch-2');
  ledger.markSubmitting('batch-2');
  ledger.markProven('batch-2', { verified: true, memberIds: ['q-2'] });
  assert.deepEqual(ledger.snapshot().map(item => [item.id, item.state]), [
    ['q-1', 'persisted'], ['q-2', 'proven']
  ]);
});


test('proven compaction never removes unresolved finals', () => {
  const ledger = new DeliveryLedger();
  for (let seq = 1; seq <= 120; seq += 1) {
    ledger.persist(envelope(`q-${seq}`, seq));
    if (seq <= 100) {
      ledger.markStaged([`q-${seq}`], `b-${seq}`);
      ledger.markSubmitting(`b-${seq}`);
      ledger.markProven(`b-${seq}`, { verified: true, at: seq, memberIds: [`q-${seq}`] });
    }
  }
  const removed = ledger.compactProven(30);
  assert.equal(removed.length, 70);
  assert.equal(ledger.counts().proven, 30);
  assert.equal(ledger.counts().pending, 20);
  assert.deepEqual(ledger.pending().map(item => item.id), Array.from({ length: 20 }, (_, index) => `q-${index + 101}`));
});


test('batch proof is idempotent and requires the exact member set', () => {
  const ledger = new DeliveryLedger();
  ledger.persist(envelope('q1', 1));
  ledger.persist(envelope('q2', 2));
  ledger.markStaged(['q1', 'q2'], 'b1', 10, { fingerprint: 'prompt', memberFingerprint: 'members' });
  ledger.markSubmitting('b1', 11);
  const mismatch = ledger.markBatchProven('b1', { verified: true, memberIds: ['q1'] }, 12);
  assert.equal(mismatch.accepted, false);
  assert.equal(ledger.counts().proven, 0);
  const accepted = ledger.markBatchProven('b1', {
    verified: true, memberIds: ['q2', 'q1'], fingerprint: 'prompt', memberFingerprint: 'members'
  }, 13);
  assert.equal(accepted.changed.length, 2);
  const duplicate = ledger.markBatchProven('b1', {
    verified: true, memberIds: ['q1', 'q2'], fingerprint: 'prompt', memberFingerprint: 'members'
  }, 14);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.changed.length, 0);
});
