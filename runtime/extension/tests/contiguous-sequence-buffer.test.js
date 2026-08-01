import test from 'node:test';
import assert from 'node:assert/strict';
import { ContiguousSequenceBuffer } from '../shared/contiguous-sequence-buffer.js';

const envelope = seq => ({ id: `q-${seq}`, seq, text: `Question ${seq}`, metadata: {} });

test('contiguous buffer admits only the next expected sequence', () => {
  const buffer = new ContiguousSequenceBuffer();
  assert.equal(buffer.offer(envelope(3), 10).reason, 'buffered_gap');
  assert.equal(buffer.peekReady(), null);
  assert.equal(buffer.offer(envelope(1), 11).ready, true);
  assert.equal(buffer.peekReady().id, 'q-1');
  assert.equal(buffer.confirm(1, 12), true);
  assert.equal(buffer.expectedSeq, 2);
  assert.equal(buffer.offer(envelope(2), 13).ready, true);
  assert.equal(buffer.confirm(2, 14), true);
  assert.equal(buffer.peekReady().id, 'q-3');
});

test('duplicates are acknowledged without creating another buffered copy', () => {
  const buffer = new ContiguousSequenceBuffer();
  buffer.offer(envelope(2), 10);
  assert.equal(buffer.offer(envelope(2), 11).reason, 'duplicate_buffered');
  buffer.offer(envelope(1), 12);
  buffer.confirm(1, 13);
  buffer.confirm(2, 14);
  assert.equal(buffer.offer(envelope(2), 15).reason, 'duplicate_ack');
});

test('buffer snapshot restores unresolved gaps across reload', () => {
  const buffer = new ContiguousSequenceBuffer();
  buffer.offer(envelope(4), 100);
  buffer.offer(envelope(3), 110);
  const restored = new ContiguousSequenceBuffer(buffer.snapshot());
  assert.equal(restored.lastAcceptedSeq, 0);
  assert.equal(restored.bufferedCount, 2);
  assert.equal(restored.status(4000).timedOut, true);
  assert.equal(restored.status(4000).expectedSeq, 1);
});

test('full buffer refuses new ownership without deleting existing finals', () => {
  const buffer = new ContiguousSequenceBuffer({}, { maxBuffered: 2 });
  buffer.offer(envelope(3));
  buffer.offer(envelope(4));
  assert.equal(buffer.offer(envelope(5)).reason, 'gap_buffer_full');
  assert.equal(buffer.bufferedCount, 2);
});
