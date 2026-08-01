import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSessionEnd, validateSessionEnd } from '../shared/session-end-guard.js';

function snapshot(extra = {}) {
  return { ledger: [], batchState: { active: null }, timeline: [], ...extra };
}

test('clean session prepare issues a short-lived confirmation token', () => {
  const prepared = prepareSessionEnd(snapshot(), { now: 1000, token: 'token-1', ttlMs: 30000 });
  assert.equal(prepared.canEnd, true);
  assert.equal(prepared.counts.actionable, 0);
  assert.equal(validateSessionEnd(prepared, { token: 'token-1', mode: 'clean', now: 2000 }).ok, true);
});

test('actionable session blocks end without archive-and-end confirmation', () => {
  const prepared = prepareSessionEnd(snapshot({
    ledger: [{ id: 'q1', state: 'persisted' }, { id: 'q2', state: 'submitting' }],
    senderOutboxState: { count: 1 }
  }), { now: 1000, token: 'token-2' });
  assert.equal(prepared.canEnd, false);
  assert.deepEqual(prepared.counts, { actionable: 2, inFlight: 1, unpersisted: 1 });
  assert.equal(validateSessionEnd(prepared, { token: 'token-2', mode: 'clean', now: 2000 }).ok, false);
  assert.equal(validateSessionEnd(prepared, { token: 'token-2', mode: 'archive_and_end', now: 2000 }).ok, true);
});

test('expired or mismatched end token is rejected', () => {
  const prepared = prepareSessionEnd(snapshot(), { now: 1000, token: 'token', ttlMs: 5000 });
  assert.equal(validateSessionEnd(prepared, { token: 'wrong', mode: 'clean', now: 1050 }).error, 'confirmation_token_invalid');
  assert.equal(validateSessionEnd(prepared, { token: 'token', mode: 'clean', now: 7000 }).error, 'confirmation_token_expired');
});


test('durable sender outbox summary survives timeline compaction for end safety', () => {
  const prepared = prepareSessionEnd(snapshot({ senderOutboxState: { count: 3 }, timeline: [] }), { now: 1000, token: 'durable' });
  assert.equal(prepared.counts.unpersisted, 3);
  assert.equal(prepared.canEnd, false);
});


test('session end storage key is deterministic and session scoped', async () => {
  const { senderOutboxStorageKey } = await import('../shared/session-end-guard.js');
  assert.equal(senderOutboxStorageKey('s1'), 'pmia_sender_outbox_v2:s1');
});
