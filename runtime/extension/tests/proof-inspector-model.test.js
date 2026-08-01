import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveProofInspector } from '../dashboard/proof-inspector-model.js';

test('proof inspector reports exact verified batch membership', () => {
  const value = deriveProofInspector({ timeline: [{ type: 'batch_proven', data: { batchId: 'b1', memberIds: ['q1', 'q2'] } }] });
  assert.equal(value.state, 'verified');
  assert.equal(value.memberCount, 2);
});

test('proof inspector exposes rejection reason', () => {
  const value = deriveProofInspector({ timeline: [{ type: 'batch_proof_rejected', data: { batchId: 'b1', reason: 'proof_member_mismatch' } }] });
  assert.equal(value.state, 'rejected');
  assert.equal(value.detail, 'proof_member_mismatch');
});


test('benign duplicate proof keeps an already verified batch green', () => {
  const value = deriveProofInspector({ timeline: [
    { type: 'batch_proven', data: { batchId: 'b1', memberIds: ['q1'] } },
    { type: 'batch_proof_duplicate', data: { batchId: 'b1', memberIds: ['q1'] } }
  ] });
  assert.equal(value.state, 'verified');
  assert.match(value.detail, /duplicate proof was ignored/);
});
