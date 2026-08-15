import test from 'node:test';
import assert from 'node:assert/strict';

const sequenceModule = await import('../shared/envelope-sequence.js').catch(() => null);

test('boot context never consumes the live-question sequence', () => {
  assert.ok(sequenceModule, 'envelope sequence helper must exist');
  assert.deepEqual(sequenceModule.sequenceForEnvelope(0, 'boot'), {
    seq: 0,
    next: 0,
    advanced: false
  });
  assert.deepEqual(sequenceModule.sequenceForEnvelope(7, 'boot'), {
    seq: 0,
    next: 7,
    advanced: false
  });
});

test('only live questions advance the contiguous sequence', () => {
  assert.ok(sequenceModule, 'envelope sequence helper must exist');
  assert.deepEqual(sequenceModule.sequenceForEnvelope(0, 'question'), {
    seq: 1,
    next: 1,
    advanced: true
  });
  assert.deepEqual(sequenceModule.sequenceForEnvelope(1, 'question'), {
    seq: 2,
    next: 2,
    advanced: true
  });
});

test('sender runtime applies question-only sequencing to boot and live envelopes', async () => {
  const { readFile } = await import('node:fs/promises');
  const entry = await readFile(new URL('../content/entry.js', import.meta.url), 'utf8');
  const start = entry.indexOf('async function forwardText');
  const end = entry.indexOf("if (runtimeConfig.role === 'sender')", start);
  const block = entry.slice(start, end);
  assert.match(block, /sequenceForEnvelope\(senderSequence, kind\)/);
  assert.match(block, /if \(sequence\.advanced\)/);
  assert.match(block, /seq:\s*sequence\.seq/);
  assert.doesNotMatch(block, /const nextSenderSequence = nextSequence\(senderSequence\)/);
});
