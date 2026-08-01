import test from 'node:test';
import assert from 'node:assert/strict';
import { createSenderOutbox } from '../content/sender-outbox.js';

const envelope = { id: 'q1', sessionId: 's1', sourceProvider: 'chatgpt', kind: 'question', seq: 1, text: 'Q', metadata: {}, createdAt: 1 };

test('outbox exposes durable retry intent after an unconfirmed send', async () => {
  let saved = [];
  const outbox = createSenderOutbox({ initialEntries: [], saveState: async value => { saved = value; }, now: () => 1000, random: () => 0.5 });
  await outbox.enqueue(envelope);
  await outbox.replay(async () => ({ ok: false, persisted: false, error: 'receiver_busy' }));
  const snapshot = outbox.snapshot();
  assert.equal(snapshot.retryIntent.reason, 'receiver_busy');
  assert.ok(snapshot.retryIntent.dueAt > 1000);
  const restored = createSenderOutbox({ initialEntries: saved, saveState: async () => {}, now: () => 1001 });
  assert.equal(restored.snapshot().retryIntent.envelopeId, 'q1');
});

test('outbox clears retry intent only after persisted acknowledgement', async () => {
  const outbox = createSenderOutbox({ initialEntries: [], saveState: async () => {} });
  await outbox.enqueue(envelope);
  await outbox.replay(async () => ({ ok: true, persisted: true }));
  assert.equal(outbox.snapshot().retryIntent, null);
});