import test from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryLedger } from '../shared/delivery-ledger.js';
import { BatchPlanner } from '../shared/batch-planner.js';
import { createSenderOutbox } from '../content/sender-outbox.js';

function envelope(seq) {
  return {
    id: `q-${seq}`,
    sessionId: 'burst-session',
    sourceProvider: 'chatgpt',
    kind: 'question',
    seq,
    text: `Interview question ${seq}`,
    metadata: {},
    createdAt: seq
  };
}

function storage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); }
  };
}

test('100-final burst survives duplicate input generation backlog restart and complete proof', async () => {
  const area = storage();
  const outbox = createSenderOutbox({ storage: area, key: 'burst-outbox' });
  const ledger = new DeliveryLedger();
  const planner = new BatchPlanner();

  for (let seq = 1; seq <= 100; seq += 1) {
    const item = envelope(seq);
    assert.equal(outbox.enqueue(item), true);
    assert.equal(ledger.persist(item).accepted, true);
    assert.equal(planner.add(item).accepted, true);
    if (seq % 10 === 0) {
      assert.equal(ledger.persist({ ...item }).duplicate, true);
      assert.equal(planner.add({ ...item }).duplicate, true);
    }
  }

  assert.equal(outbox.size, 100);
  assert.equal(ledger.snapshot().length, 100);
  assert.equal(planner.nextSize, 100);

  let calls = 0;
  await outbox.replay(async () => {
    calls += 1;
    return { ok: false, persisted: false, error: 'worker_restart' };
  });
  assert.equal(calls, 1);
  assert.equal(outbox.size, 100);

  const restoredLedger = new DeliveryLedger(ledger.exportState());
  const restoredPlanner = new BatchPlanner(planner.exportState());
  assert.equal(restoredLedger.pending().length, 100);
  assert.equal(restoredPlanner.nextSize, 100);

  const batch = restoredPlanner.freezeNext(1000);
  assert.equal(batch.prompt.questionCount, 100);
  assert.equal(batch.prompt.focusId, 'q-100');
  assert.deepEqual(batch.prompt.memberIds, Array.from({ length: 100 }, (_, index) => `q-${index + 1}`));
  assert.match(batch.prompt.text, /EARLIER QUESTION 1:/);
  assert.match(batch.prompt.text, /LATEST QUESTION \(HIGHEST PRIORITY\):[\s\S]*Interview question 100/);

  restoredLedger.markStaged(batch.prompt.memberIds, batch.id, 1001);
  restoredLedger.markSubmitting(batch.id, 1002);
  const proven = restoredLedger.markProven(batch.id, {
    verified: true,
    proof: 'new_rendered_turn',
    fingerprint: batch.prompt.fingerprint,
    memberIds: batch.prompt.memberIds
  }, 1003);
  assert.equal(proven.length, 100);
  assert.equal(restoredLedger.counts().unresolved, 0);
  assert.equal(restoredLedger.counts().proven, 100);

  await outbox.replay(async item => ({ ok: true, persisted: true, envelopeId: item.id }));
  assert.equal(outbox.size, 0);
});

test('newer proof never erases an older unresolved final in a burst', () => {
  const ledger = new DeliveryLedger();
  for (let seq = 1; seq <= 10; seq += 1) ledger.persist(envelope(seq));
  ledger.markStaged(['q-10'], 'latest-batch');
  ledger.markSubmitting('latest-batch');
  ledger.markProven('latest-batch', { verified: true });
  assert.deepEqual(ledger.snapshot().map(item => item.state), [
    'persisted', 'persisted', 'persisted', 'persisted', 'persisted',
    'persisted', 'persisted', 'persisted', 'persisted', 'proven'
  ]);
});
