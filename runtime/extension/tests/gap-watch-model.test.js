import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveGapWatch } from '../dashboard/gap-watch-model.js';

test('Gap Watch reports missing sequence and buffered count', () => {
  const value = deriveGapWatch({ timeline: [{
    type: 'sequence_gap', at: 1000,
    data: { expectedSeq: 4, bufferedCount: 2, highestBufferedSeq: 6 }
  }] }, 2500);
  assert.equal(value.state, 'waiting');
  assert.equal(value.expectedSeq, 4);
  assert.equal(value.bufferedCount, 2);
});

test('Gap Watch clears after a gap-cleared event', () => {
  const value = deriveGapWatch({ timeline: [
    { type: 'sequence_gap', at: 1000, data: { expectedSeq: 2, bufferedCount: 1 } },
    { type: 'sequence_gap_cleared', at: 1200, data: {} }
  ] }, 2000);
  assert.equal(value.state, 'clear');
});
