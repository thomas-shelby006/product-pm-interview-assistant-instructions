import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStateQuarantine,
  preserveStateQuarantine,
  quarantineAudit,
  selectRecoverableState
} from '../shared/state-quarantine.js';

test('state quarantine clones one blocked snapshot with safe metadata', () => {
  const raw = { schemaVersion: 3, writerVersion: 'future', sessions: [{ sessionId: 's1' }] };
  const value = createStateQuarantine(raw, 'future_schema', 100);
  raw.sessions[0].sessionId = 'changed';
  assert.equal(value.reason, 'future_schema');
  assert.equal(value.capturedAt, 100);
  assert.equal(value.schemaVersion, 3);
  assert.equal(value.writerVersion, 'future');
  assert.deepEqual(value.state.sessions, [{ sessionId: 's1' }]);
  assert.ok(value.bytes > 0);
});

test('existing blocked quarantine is not overwritten by repeated retries', () => {
  const first = createStateQuarantine({ schemaVersion: 3, sessions: [{ sessionId: 'first' }] }, 'future_schema', 100);
  const next = createStateQuarantine({ schemaVersion: 3, sessions: [{ sessionId: 'next' }] }, 'future_schema', 200);
  assert.deepEqual(preserveStateQuarantine(first, next), first);
});

test('quarantine audit contains no session payload', () => {
  const value = createStateQuarantine({ schemaVersion: 3, sessions: [{ sessionId: 'secret' }] }, 'future_schema', 100);
  const audit = quarantineAudit(value);
  assert.deepEqual(Object.keys(audit).sort(), ['bytes', 'capturedAt', 'present', 'reason', 'schemaVersion', 'writerVersion'].sort());
  assert.doesNotMatch(JSON.stringify(audit), /secret/);
});

test('recoverable selection prefers valid current then previous and never activates quarantine', () => {
  assert.equal(selectRecoverableState({ valid: true }, { valid: true }, { state: { blocked: true } }).source, 'current');
  assert.equal(selectRecoverableState(null, { valid: true }, { state: { blocked: true } }).source, 'previous');
  const blocked = selectRecoverableState(null, null, { state: { blocked: true } });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'quarantined_state_only');
});

import { createRuntimePilotStore } from '../shared/runtime-pilot-store.js';

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

test('runtime store quarantines a future schema without overwriting it', async () => {
  const key = 'pilot';
  const area = memoryArea({ [key]: { schemaVersion: 3, writerVersion: 'future', sessions: [{ sessionId: 'first' }] } });
  const store = createRuntimePilotStore({ storageArea: area, key, writerVersion: '0.7.0' });
  await assert.rejects(store.load(), /runtime_state_blocked:future_schema/);
  const captured = structuredClone(area.data[`${key}_quarantine`]);
  area.data[key] = { schemaVersion: 3, writerVersion: 'future', sessions: [{ sessionId: 'second' }] };
  store.resetCache();
  await assert.rejects(store.load(), /runtime_state_blocked:future_schema/);
  assert.deepEqual(area.data[`${key}_quarantine`], captured);
  assert.equal(store.audit().quarantine.present, true);
});
