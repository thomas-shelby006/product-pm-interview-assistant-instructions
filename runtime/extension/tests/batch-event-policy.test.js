import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPersistBatchEvent, safeBatchTelemetry } from '../shared/batch-event-policy.js';

test('transient draft events broadcast without repeated session-storage persistence', () => {
  assert.equal(shouldPersistBatchEvent({ type: 'batch_accumulated' }), false);
  assert.equal(shouldPersistBatchEvent({ type: 'next_batch_draft' }), false);
  assert.equal(shouldPersistBatchEvent({ type: 'batch_submitting' }), true);
  assert.equal(shouldPersistBatchEvent({ type: 'batch_submitted' }), true);
  assert.equal(shouldPersistBatchEvent({ type: 'batch_answer_complete' }), true);
  assert.equal(shouldPersistBatchEvent({ type: 'batch_policy_changed' }), true);
});

test('safe batch telemetry contains identity and policy but no question text', () => {
  const checkpoint = safeBatchTelemetry({
    active: {
      id: 'batch-1',
      prompt: {
        memberIds: ['q1', 'q2'],
        questionCount: 2,
        focusId: 'q2',
        fingerprint: 'abcd1234',
        text: 'Sensitive question text'
      },
      submittedAt: 100
    },
    next: {
      count: 1,
      prompt: {
        memberIds: ['q3'],
        questionCount: 1,
        focusId: 'q3',
        fingerprint: 'efgh5678',
        text: 'Another sensitive question'
      }
    },
    hold: true,
    autoSubmit: false
  });
  assert.deepEqual(checkpoint.active.memberIds, ['q1', 'q2']);
  assert.deepEqual(checkpoint.next.memberIds, ['q3']);
  assert.equal(checkpoint.hold, true);
  assert.equal(checkpoint.autoSubmit, false);
  assert.equal(JSON.stringify(checkpoint).includes('Sensitive question'), false);
});
