import test from 'node:test';
import assert from 'node:assert/strict';
import { ReceiverCreditHysteresis } from '../shared/receiver-credit-hysteresis.js';

function credits(available, reason = available ? 'credit_available' : 'buffer_capacity_exhausted') {
  return { available, capacity: 8, buffered: 8 - available, active: 0, reason, state: available ? 'available' : 'backpressure', canAccept: available > 0, retryAfterMs: available ? 0 : 250 };
}

test('credit hysteresis drops immediately and recovers only after a stable window', () => {
  const guard = new ReceiverCreditHysteresis({ recoveryWindowMs: 500 });
  assert.equal(guard.update(credits(4), { now: 0 }).available, 4);
  assert.equal(guard.update(credits(0), { now: 100 }).available, 0);
  const early = guard.update(credits(4), { now: 200 });
  assert.equal(early.available, 0);
  assert.equal(early.hysteresisState, 'recovering');
  assert.equal(guard.update(credits(4), { now: 699 }).available, 0);
  const recovered = guard.update(credits(4), { now: 700 });
  assert.equal(recovered.available, 4);
  assert.equal(recovered.hysteresisState, 'stable');
});

test('critical pressure forces zero and resets the recovery window', () => {
  const guard = new ReceiverCreditHysteresis({ recoveryWindowMs: 300 });
  guard.update(credits(5), { now: 0 });
  const blocked = guard.update(credits(5), { now: 100, critical: true, reason: 'storage_critical' });
  assert.equal(blocked.available, 0);
  assert.equal(blocked.reason, 'storage_critical');
  assert.equal(guard.update(credits(5), { now: 101 }).available, 0);
  assert.equal(guard.update(credits(5), { now: 400 }).available, 0);
  assert.equal(guard.update(credits(5), { now: 401 }).available, 5);
});

test('credit hysteresis does not oscillate during repeated short bursts', () => {
  const guard = new ReceiverCreditHysteresis({ recoveryWindowMs: 400 });
  guard.update(credits(6), { now: 0 });
  guard.update(credits(0), { now: 100 });
  assert.equal(guard.update(credits(6), { now: 200 }).available, 0);
  guard.update(credits(0), { now: 300 });
  assert.equal(guard.update(credits(6), { now: 400 }).available, 0);
  assert.equal(guard.update(credits(6), { now: 799 }).available, 0);
  assert.equal(guard.update(credits(6), { now: 800 }).available, 6);
});

test('configured recovery window is respected exactly', () => {
  const guard = new ReceiverCreditHysteresis({ recoveryWindowMs: 50 });
  guard.update(credits(0), { now: 10 });
  guard.update(credits(2), { now: 20 });
  assert.equal(guard.update(credits(2), { now: 69 }).available, 0);
  assert.equal(guard.update(credits(2), { now: 70 }).available, 2);
});
