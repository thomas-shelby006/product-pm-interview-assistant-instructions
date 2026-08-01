import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionEntries } from '../shared/batch-partitioner.js';

function entry(seq, text = `Question ${seq}`) {
  return { id: `q${seq}`, envelope: { id: `q${seq}`, seq, text } };
}

test('batch partitioner preserves every entry in exact sequence', () => {
  const entries = Array.from({ length: 11 }, (_, index) => entry(index + 1));
  const partitions = partitionEntries(entries, { maxMembers: 4, maxChars: 10000 });
  assert.deepEqual(partitions.map(group => group.map(item => item.id)), [
    ['q1', 'q2', 'q3', 'q4'],
    ['q5', 'q6', 'q7', 'q8'],
    ['q9', 'q10', 'q11']
  ]);
  assert.deepEqual(partitions.flat().map(item => item.id), entries.map(item => item.id));
});

test('batch partitioner respects composed-character budget without splitting a question', () => {
  const entries = [entry(1, 'A'.repeat(40)), entry(2, 'B'.repeat(40)), entry(3, 'C'.repeat(140))];
  const partitions = partitionEntries(entries, {
    maxMembers: 8,
    maxChars: 100,
    measure: group => group.reduce((sum, item) => sum + item.envelope.text.length, 0)
  });
  assert.deepEqual(partitions.map(group => group.map(item => item.id)), [['q1', 'q2'], ['q3']]);
  assert.equal(partitions[1][0].envelope.text.length, 140);
});
