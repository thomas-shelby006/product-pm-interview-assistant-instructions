import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimePilotStore } from '../shared/runtime-pilot-store.js';

function memoryArea() {
  const data = {};
  return {
    data,
    async get(key) { return key ? { [key]: data[key] } : { ...data }; },
    async set(values) { Object.assign(data, values); },
    async remove(key) {
      for (const item of Array.isArray(key) ? key : [key]) delete data[item];
    }
  };
}

test('runtime pilot store restores session-only state', async () => {
  const area = memoryArea();
  const store = createRuntimePilotStore({ storageArea: area });
  const state = await store.load();
  state.setMode('pmia_session', 'paused', 1000);
  await store.save(state);
  store.resetCache();
  const restored = await store.load();
  assert.equal(restored.snapshot('pmia_session', 2000).mode, 'paused');
});
