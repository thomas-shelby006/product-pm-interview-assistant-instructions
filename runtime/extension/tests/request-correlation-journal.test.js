import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestCorrelationJournal } from '../shared/request-correlation-journal.js';

test('correlation journal accepts one response for the matching epoch', () => {
  const journal = new RequestCorrelationJournal({ maxEntries: 3 });
  journal.begin('r1', { epoch: 2, operation: 'deliver', now: 10 });
  assert.equal(journal.acceptResponse('r1', 1).reason, 'stale_epoch');
  assert.equal(journal.acceptResponse('r1', 2).accepted, true);
  journal.complete('r1', { ok: true }, 20);
  assert.equal(journal.acceptResponse('r1', 2).reason, 'duplicate_response');
  assert.deepEqual(journal.result('r1'), { ok: true });
});

test('correlation journal is bounded and keeps newest completed results', () => {
  const journal = new RequestCorrelationJournal({ maxEntries: 2 });
  for (let index = 1; index <= 3; index += 1) {
    journal.begin(`r${index}`, { epoch: 1, now: index });
    journal.complete(`r${index}`, { index }, index + 10);
  }
  assert.equal(journal.result('r1'), null);
  assert.deepEqual(journal.result('r3'), { index: 3 });
  assert.equal(journal.snapshot().length, 2);
});