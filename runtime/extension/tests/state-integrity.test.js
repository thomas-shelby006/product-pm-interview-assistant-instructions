import test from 'node:test';
import assert from 'node:assert/strict';
import {
  digestRuntimeEnvelope,
  sealRuntimeEnvelope,
  verifyRuntimeEnvelope
} from '../shared/state-integrity.js';
import { createRuntimePilotStore } from '../shared/runtime-pilot-store.js';

test('runtime envelope digest is independent of object key order', () => {
  const first = { schemaVersion: 3, writerVersion: '0.9.0', committedAt: 10, sessions: [{ sessionId: 's1', mode: 'paused' }] };
  const second = { sessions: [{ mode: 'paused', sessionId: 's1' }], committedAt: 10, writerVersion: '0.9.0', schemaVersion: 3 };
  assert.equal(digestRuntimeEnvelope(first), digestRuntimeEnvelope(second));
});

test('sealed runtime envelope detects content mutation', () => {
  const sealed = sealRuntimeEnvelope({ schemaVersion: 3, writerVersion: '0.9.0', committedAt: 10, sessions: [{ sessionId: 's1' }] });
  assert.equal(verifyRuntimeEnvelope(sealed).ok, true);
  sealed.sessions[0].sessionId = 'changed';
  const result = verifyRuntimeEnvelope(sealed);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'digest_mismatch');
});

function memoryArea(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(key) {
      if (Array.isArray(key)) return Object.fromEntries(key.map(item => [item, data[item]]));
      return key ? { [key]: data[key] } : { ...data };
    },
    async set(values) { Object.assign(data, values); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; }
  };
}

test('store recovers a valid prior envelope after current digest mismatch', async () => {
  const key = 'pilot';
  const previous = sealRuntimeEnvelope({ schemaVersion: 3, writerVersion: '0.9.0', committedAt: 10, sessions: [{ sessionId: 'old', mode: 'paused' }] });
  const current = structuredClone(previous);
  current.sessions[0].sessionId = 'corrupt';
  const area = memoryArea({ [key]: current, [`${key}_previous_applied`]: previous });
  const store = createRuntimePilotStore({ storageArea: area, key, writerVersion: '0.9.0' });
  const state = await store.load();
  assert.equal(state.snapshot('old', 20).mode, 'paused');
  assert.equal(store.audit().integrity.state, 'recovered');
  assert.equal(store.audit().integrity.reason, 'digest_mismatch');
});

test('store blocks and quarantines when current and previous digests are invalid', async () => {
  const key = 'pilot';
  const invalid = { schemaVersion: 3, writerVersion: '0.9.0', committedAt: 10, integrityDigest: 'bad', sessions: [{ sessionId: 's1' }] };
  const area = memoryArea({ [key]: invalid, [`${key}_previous_applied`]: invalid });
  const store = createRuntimePilotStore({ storageArea: area, key, writerVersion: '0.9.0' });
  await assert.rejects(store.load(), /runtime_state_blocked:digest_mismatch/);
  assert.equal(store.audit().integrity.state, 'blocked');
  assert.equal(area.data[`${key}_quarantine`].reason, 'digest_mismatch');
});
