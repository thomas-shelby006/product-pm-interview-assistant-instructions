import test from 'node:test';
import assert from 'node:assert/strict';
import { sendWithRegistrationRecovery } from '../content/registration-recovery.js';

test('final forwarding re-registers once and retries the same payload after ownership loss', async () => {
  const payload = { type: 'PMIA_FORWARD', envelope: { id: 'q1', seq: 4 } };
  const sent = [];
  let attempt = 0;
  const result = await sendWithRegistrationRecovery({
    payload,
    async send(value) {
      sent.push(value);
      attempt += 1;
      return attempt === 1
        ? { ok: false, terminal: true, error: 'sender_not_registered' }
        : { ok: true, delivered: true };
    },
    async register() { return true; }
  });
  assert.equal(result.recovered, true);
  assert.equal(result.attempts, 2);
  assert.deepEqual(sent, [payload, payload]);
  assert.equal(result.response.delivered, true);
});

test('forward recovery does not retry ordinary delivery outcomes or failed registration', async () => {
  let registers = 0;
  let sends = 0;
  const ordinary = await sendWithRegistrationRecovery({
    payload: { id: 'p1' },
    async send() { sends += 1; return { ok: true, queued: true }; },
    async register() { registers += 1; return true; }
  });
  assert.equal(ordinary.attempts, 1);
  assert.equal(registers, 0);

  const failed = await sendWithRegistrationRecovery({
    payload: { id: 'p2' },
    async send() { sends += 1; return { ok: false, error: 'sender_not_registered' }; },
    async register() { registers += 1; return false; }
  });
  assert.equal(failed.attempts, 1);
  assert.equal(registers, 1);
  assert.equal(sends, 2);
});
