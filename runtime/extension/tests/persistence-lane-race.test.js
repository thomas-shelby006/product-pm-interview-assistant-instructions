import test from 'node:test';
import assert from 'node:assert/strict';
import { racePersistenceLanes } from '../content/persistence-lane-race.js';

test('fallback completes ownership when the hidden-page direct lane never settles', async () => {
  const result = await racePersistenceLanes({
    direct: () => new Promise(() => {}),
    fallback: async () => ({ ok: true, persisted: true, lane: 'message' })
  });
  assert.equal(result.persisted, true);
  assert.equal(result.lane, 'message');
});

test('authoritative direct persistence remains the fast path', async () => {
  let fallbackStarted = false;
  const result = await racePersistenceLanes({
    direct: async () => ({ ok: true, persisted: true, lane: 'direct' }),
    fallback: async () => { fallbackStarted = true; return ({ ok: true, persisted: true, lane: 'message' }); }
  });
  assert.equal(result.lane, 'direct');
  assert.equal(fallbackStarted, true);
});

test('non-authoritative direct response waits for the message fallback', async () => {
  const result = await racePersistenceLanes({
    direct: async () => ({ ok: false, persisted: false, error: 'request_pending' }),
    fallback: async () => ({ ok: true, persisted: true, lane: 'message' })
  });
  assert.equal(result.persisted, true);
  assert.equal(result.lane, 'message');
});

test('fallback errors are returned as bounded non-authoritative results', async () => {
  const result = await racePersistenceLanes({
    direct: null,
    fallback: async () => { throw new Error('worker_offline'); }
  }).catch(error => ({ thrown: error.message }));
  assert.equal(result.thrown, 'worker_offline');
});
