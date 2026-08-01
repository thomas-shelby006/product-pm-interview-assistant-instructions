import test from 'node:test';
import assert from 'node:assert/strict';
import { createSenderOutbox, nextRetryDelay } from '../content/sender-outbox.js';

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
  await outbox.enqueue(envelope('q-1', 1));
  await outbox.replay(async () => ({ ok: false, persisted: false, error: 'worker_offline' }));
  assert.equal(outbox.size, 1);
  await outbox.replay(async () => ({ ok: true, persisted: true, queued: true }));
  assert.equal(outbox.size, 0);
});

test('sender outbox reloads and replays in sequence order', async () => {
  const area = storage();
  const first = createSenderOutbox({ storage: area, key: 'outbox' });
  await first.enqueue(envelope('q-2', 2));
  await first.enqueue(envelope('q-1', 1));
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
  await outbox.enqueue(envelope('q-1', 1));
  await outbox.enqueue(envelope('q-2', 2));
  const seen = [];
  await outbox.replay(async item => {
    seen.push(item.id);
    return { ok: false, persisted: false };
  });
  assert.deepEqual(seen, ['q-1']);
  assert.equal(outbox.size, 2);
});


test('sender outbox schedules one ordered retry with capped jittered backoff', async () => {
  let now = 1000;
  const timers = [];
  const outbox = createSenderOutbox({
    storage: storage(), key: 'outbox', now: () => now, random: () => .5,
    setTimer(fn, delay) { timers.push({ fn, delay }); return timers.length; },
    clearTimer() {}
  });
  await outbox.enqueue(envelope('q-2', 2));
  await outbox.enqueue(envelope('q-1', 1));
  await outbox.replay(async () => ({ ok: false, persisted: false, error: 'offline' }));
  assert.equal(outbox.snapshot().attempts, 1);
  assert.equal(outbox.schedule(async () => ({ ok: true, persisted: true })), true);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, nextRetryDelay(0, () => .5));
});

test('retry now resets to immediate ordered replay without duplicating persisted entries', async () => {
  const outbox = createSenderOutbox({ storage: storage(), key: 'outbox' });
  await outbox.enqueue(envelope('q-2', 2));
  await outbox.enqueue(envelope('q-1', 1));
  const seen = [];
  await outbox.retryNow(async item => {
    seen.push(item.id);
    return { ok: true, persisted: true };
  });
  assert.deepEqual(seen, ['q-1', 'q-2']);
  assert.equal(outbox.size, 0);
});

test('retry delay is capped and jitter remains bounded', () => {
  assert.equal(nextRetryDelay(0, () => 0), 200);
  assert.equal(nextRetryDelay(0, () => 1), 300);
  assert.ok(nextRetryDelay(99, () => 1) <= 9600);
});


test('sender outbox rolls back an enqueue when session persistence fails', async () => {
  const outbox = createSenderOutbox({
    initialEntries: [],
    saveState: async () => { throw new Error('quota'); }
  });
  assert.equal(await outbox.enqueue(envelope('q-1', 1)), false);
  assert.equal(outbox.size, 0);
  assert.equal(outbox.snapshot().persistenceError, 'quota');
});

test('sender outbox exposes restored count and source without envelope text', () => {
  const outbox = createSenderOutbox({
    initialEntries: [{ envelope: envelope('q-1', 1) }],
    restoredCount: 1,
    recoverySource: 'extension_session',
    saveState: async () => {}
  });
  const snapshot = outbox.snapshot();
  assert.equal(snapshot.restoredCount, 1);
  assert.equal(snapshot.recoverySource, 'extension_session');
  assert.equal(JSON.stringify(snapshot).includes('Question 1'), false);
});


test('replay continues when the send path already acknowledged the current entry', async () => {
  const outbox = createSenderOutbox({ storage: storage(), key: 'outbox' });
  await outbox.enqueue(envelope('q-1', 1));
  await outbox.enqueue(envelope('q-2', 2));
  const seen = [];
  await outbox.replay(async item => {
    seen.push(item.id);
    await outbox.ackPersisted(item.id);
    return { ok: true, persisted: true };
  });
  assert.deepEqual(seen, ['q-1', 'q-2']);
  assert.equal(outbox.size, 0);
});
