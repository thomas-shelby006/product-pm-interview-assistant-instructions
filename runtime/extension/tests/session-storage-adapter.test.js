import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStorageAdapter } from '../content/session-storage-adapter.js';

function legacy(value = null) {
  const data = new Map(value === null ? [] : [['legacy', JSON.stringify(value)]]);
  return {
    getItem(key) { return data.get(key) ?? null; },
    removeItem(key) { data.delete(key); },
    has(key) { return data.has(key); }
  };
}

test('session adapter restores extension-session outbox state', async () => {
  const calls = [];
  const adapter = await createSessionStorageAdapter({
    sessionId: 's', legacyStorage: legacy(), legacyKey: 'legacy',
    send: async message => { calls.push(message); return { ok: true, value: [{ envelope: { id: 'q1', sessionId: 's' } }] }; }
  });
  assert.equal(adapter.restoredCount, 1);
  assert.equal(adapter.recoverySource, 'extension_session');
  assert.equal(calls[0].type, 'PMIA_SESSION_STATE_GET');
});

test('session adapter migrates legacy page state only after durable write', async () => {
  const area = legacy([{ envelope: { id: 'q1', sessionId: 's' } }]);
  const calls = [];
  const adapter = await createSessionStorageAdapter({
    sessionId: 's', legacyStorage: area, legacyKey: 'legacy',
    send: async message => {
      calls.push(message);
      return message.type === 'PMIA_SESSION_STATE_GET' ? { ok: true, value: null } : { ok: true };
    }
  });
  assert.equal(adapter.recoverySource, 'legacy_migrated');
  assert.equal(area.has('legacy'), false);
  assert.equal(calls[1].type, 'PMIA_SESSION_STATE_SET');
});

test('session adapter retains legacy state when migration write fails', async () => {
  const area = legacy([{ envelope: { id: 'q1', sessionId: 's' } }]);
  await assert.rejects(createSessionStorageAdapter({
    sessionId: 's', legacyStorage: area, legacyKey: 'legacy',
    send: async message => message.type === 'PMIA_SESSION_STATE_GET'
      ? { ok: true, value: null }
      : { ok: false, error: 'storage_failed' }
  }), /storage_failed/);
  assert.equal(area.has('legacy'), true);
});
