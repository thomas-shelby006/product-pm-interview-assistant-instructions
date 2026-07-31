import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionLogStore,
  sessionRoleLogKeys
} from '../shared/session-log-store.js';

function storage(initial = {}) {
  const state = { ...initial };
  return {
    state,
    async get(key) {
      if (key === null) return { ...state };
      if (Array.isArray(key)) {
        return Object.fromEntries(key.filter(item => item in state).map(item => [item, state[item]]));
      }
      return key in state ? { [key]: state[key] } : {};
    },
    async set(values) { Object.assign(state, values); },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key];
    }
  };
}

test('session log store keeps transcript events only in session storage', async () => {
  const sessionArea = storage();
  const localArea = storage();
  const store = createSessionLogStore({ sessionArea, legacyLocalArea: localArea });
  await store.append('s1', 'sender', { type: 'sender_text', text: 'Question?' });
  assert.equal(sessionArea.state.pmia_log_s1_sender.length, 1);
  assert.deepEqual(localArea.state, {});
});

test('session log store clears both role logs for one session', async () => {
  const sessionArea = storage({
    pmia_log_s1_sender: [{ type: 'sender_text' }],
    pmia_log_s1_receiver: [{ type: 'answer' }],
    pmia_log_other_sender: [{ type: 'keep' }]
  });
  const store = createSessionLogStore({ sessionArea });
  await store.clearSession('s1');
  assert.deepEqual(sessionRoleLogKeys('s1'), [
    'pmia_log_s1_sender',
    'pmia_log_s1_receiver'
  ]);
  assert.deepEqual(sessionArea.state, {
    pmia_log_other_sender: [{ type: 'keep' }]
  });
});

test('legacy cleanup removes only old PMIA transcript logs from local storage', async () => {
  const localArea = storage({
    pmia_log_old_sender: [{ text: 'sensitive' }],
    pmia_log_old_receiver: [{ text: 'sensitive' }],
    unrelated: 'keep'
  });
  const store = createSessionLogStore({ sessionArea: storage(), legacyLocalArea: localArea });
  assert.equal(await store.purgeLegacyLocalLogs(), 2);
  assert.deepEqual(localArea.state, { unrelated: 'keep' });
});
