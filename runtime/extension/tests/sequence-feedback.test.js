import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSequenceFeedback, compactSequenceRanges } from '../shared/sequence-feedback.js';
import { ContiguousSequenceBuffer } from '../shared/contiguous-sequence-buffer.js';

const envelope = seq => ({ id: `q${seq}`, sessionId: 's1', sourceProvider: 'chatgpt', kind: 'question', seq, text: `Q${seq}`, metadata: {}, createdAt: seq });

test('sequence feedback reports contiguous ack buffered ranges and exact nacks', () => {
  const buffer = new ContiguousSequenceBuffer({ lastAcceptedSeq: 2 });
  buffer.offer(envelope(5), 10);
  buffer.offer(envelope(7), 11);
  const feedback = deriveSequenceFeedback(buffer.snapshot(), 12);
  assert.equal(feedback.ackThrough, 2);
  assert.deepEqual(feedback.bufferedRanges, [[5, 5], [7, 7]]);
  assert.deepEqual(feedback.nackRanges, [[3, 4], [6, 6]]);
});

test('sequence range compaction preserves exact sorted membership', () => {
  assert.deepEqual(compactSequenceRanges([5, 2, 3, 3, 8, 7]), [[2, 3], [5, 5], [7, 8]]);
});