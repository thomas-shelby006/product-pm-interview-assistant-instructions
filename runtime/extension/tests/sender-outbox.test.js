import test from 'node:test';
import assert from 'node:assert/strict';
import { createSenderOutbox } from '../content/sender-outbox.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    value(key) { return values.get(key); }
  };
}

function envelope(id, seq) {
  return {
    id,
    sessionId: 's-lossless',
    sourceProvider: 'chatgpt',
    kind: 'question',
    seq,
    text: `Question ${seq}`,
    metadata: {},
    createdAt: seq
  };
}

test('sender outbox retains a final until persisted acknowledgement', async () => {
  const area = storage();
  const outbox = createSenderOutbox({ storage: area, key: 'outbox' });
  outbox.enqueue(envelope('q-1', 1));
  await outbox.replay(async () => ({ ok: false, persisted: false, error: 'worker_offline' }));
  assert.equal(outbox.size, 1);
  await outbox.replay(async () => ({ ok: true, persisted: true, queued: true }));
  assert.equal(outbox.size, 0);
});

test('sender outbox reloads and replays in sequence order', async () => {
  const area = storage();
  const first = createSenderOutbox({ storage: area, key: 'outbox' });
  first.enqueue(envelope('q-2', 2));
  first.enqueue(envelope('q-1', 1));
  const reloaded = createSenderOutbox({ storage: area, key: 'outbox' });
  const seen = [];
  await reloaded.replay(async item => {
    seen.push(item.id);
    return { ok: true, persisted: true };
  });
  assert.deepEqual(seen, ['q-1', 'q-2']);
  assert.equal(reloaded.size, 0);
});

test('sender outbox stops replay after the first unpersisted final', async () => {
  const outbox = createSenderOutbox({ storage: storage(), key: 'outbox' });
  outbox.enqueue(envelope('q-1', 1));
  outbox.enqueue(envelope('q-2', 2));
  const seen = [];
  await outbox.replay(async item => {
    seen.push(item.id);
    return { ok: false, persisted: false };
  });
  assert.deepEqual(seen, ['q-1']);
  assert.equal(outbox.size, 2);
});
