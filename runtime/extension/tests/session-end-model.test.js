import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSessionEndView } from '../dashboard/session-end-model.js';

test('session end view explains actionable in-flight and unpersisted counts', () => {
  const view = deriveSessionEndView({ counts: { actionable: 4, inFlight: 1, unpersisted: 2 }, token: 't', expiresAt: 9 });
  assert.equal(view.blocked, true);
  assert.match(view.summary, /4 unresolved/);
  assert.match(view.summary, /2 sender outbox/);
});
