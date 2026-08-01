import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandResultJournal } from '../shared/command-result-journal.js';

test('command result journal replays the original result for a duplicate request', () => {
  const journal = new CommandResultJournal();
  journal.record('req-1', 'check_live', { ok: true, reason: 'healthy', roles: { sender: { responsive: true } } }, 100, 140);
  const replay = journal.replay('req-1');
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.result, { ok: true, reason: 'healthy', roles: { sender: { responsive: true } } });
  assert.equal(journal.lookup('req-1').replayCount, 1);
});

test('command result journal is bounded and returns newest entries first', () => {
  const journal = new CommandResultJournal([], { maxEntries: 3 });
  for (let index = 1; index <= 4; index += 1) {
    journal.record(`req-${index}`, 'check_live', { ok: true, index }, index * 10, index * 10 + 5);
  }
  assert.equal(journal.lookup('req-1'), null);
  assert.deepEqual(journal.recent(2).map(item => item.requestId), ['req-4', 'req-3']);
});

test('command result journal snapshots are JSON-safe clones', () => {
  const journal = new CommandResultJournal();
  const result = { ok: true, nested: { value: 1 } };
  journal.record('req', 'repair_runtime', result, 10, 15);
  result.nested.value = 9;
  const stored = journal.lookup('req');
  assert.equal(stored.result.nested.value, 1);
  stored.result.nested.value = 7;
  assert.equal(journal.lookup('req').result.nested.value, 1);
});
