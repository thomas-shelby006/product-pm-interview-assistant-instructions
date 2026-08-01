import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateCommitJournal, recoverCommittedState } from '../shared/state-commit-journal.js';

test('commit journal advances prepared to applied generation', () => {
  const journal = createStateCommitJournal({ generation: 3, appliedGeneration: 3 });
  const prepared = journal.prepare({ stateHash: 'abc', now: 10 });
  assert.equal(prepared.generation, 4);
  assert.equal(prepared.phase, 'prepared');
  const applied = journal.apply(prepared.generation, 20);
  assert.equal(applied.phase, 'applied');
  assert.equal(applied.appliedGeneration, 4);
});

test('recovery rejects an unapplied generation and keeps last applied state', () => {
  const result = recoverCommittedState({
    currentState: [{ sessionId: 'new' }],
    previousState: [{ sessionId: 'old' }],
    journal: { phase: 'prepared', generation: 2, appliedGeneration: 1 }
  });
  assert.equal(result.recovered, true);
  assert.deepEqual(result.state, [{ sessionId: 'old' }]);
});