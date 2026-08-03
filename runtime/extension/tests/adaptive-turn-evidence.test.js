import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTurnCoordinationEvidence } from '../shared/turn-coordination-evidence.js';
import { buildSafeSupportBundle } from '../shared/support-bundle.js';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';

function snapshot() {
  return {
    sessionId: 's',
    mode: 'active',
    batchState: {
      next: { memberIds: ['q1', 'q2'], questionCount: 2 },
      turnCoordination: {
        mode: 'paused_accumulating', policy: 'adaptive', heldCount: 2,
        heldMemberIds: ['q1', 'q2'], pausedAt: 10, updatedAt: 30,
        interruption: {
          state: 'recovery_required', chainId: 'chain-1', memberIds: ['q1', 'q2'],
          activeBatchId: 'batch-1', continuationId: 'q2', attempts: 1,
          reason: 'source_answer_interrupted', failureReason: 'stop_failed'
        }
      }
    },
    timeline: [{
      id: 'evidence-1', at: 30, type: 'source_interruption_recovery_required',
      data: { chainId: 'chain-1', questionText: 'SECRET QUESTION', answerText: 'SECRET ANSWER' }
    }],
    ledger: [], ledgerCounts: {}, sender: {}, receiver: {}
  };
}

test('coordination evidence is bookmarkable and metadata-only', () => {
  const evidence = deriveTurnCoordinationEvidence(snapshot());
  assert.equal(evidence.bookmark.id, 'evidence-1');
  assert.equal(evidence.bookmark.type, 'source_interruption_recovery_required');
  assert.equal(evidence.interruption.state, 'recovery_required');
  assert.deepEqual(evidence.interruption.memberIds, ['q1', 'q2']);
  assert.equal(evidence.recommendedCommand, 'retry_carryover');
  assert.doesNotMatch(JSON.stringify(evidence), /SECRET QUESTION|SECRET ANSWER/);
});


test('safe support bundle includes coordination evidence without transcript content', () => {
  const bundle = buildSafeSupportBundle(snapshot(), {
    manifest: { name: 'PMIA', version: '0.12.0' }
  });
  assert.equal(bundle.turnCoordination.bookmark.id, 'evidence-1');
  assert.equal(bundle.turnCoordination.interruption.chainId, 'chain-1');
  assert.equal(bundle.turnCoordination.interruption.preservedCount, 2);
  assert.equal(bundle.turnCoordination.recommendedCommand, 'retry_carryover');
  assert.equal(bundle.privacy.safe, true);
  assert.doesNotMatch(JSON.stringify(bundle), /SECRET QUESTION|SECRET ANSWER/);
});

test('coordination recovery command results replay without executing a new operation', () => {
  const state = new RuntimePilotState([], { nowFn: () => 100 });
  for (const command of ['retry_carryover', 'keep_accumulating']) {
    const requestId = `${command}-request`;
    state.recordCommandResult('s', requestId, command, {
      ok: true, chainId: 'chain-1', memberIds: ['q1', 'q2']
    }, 10, 20);
    const first = state.replayCommandResult('s', requestId, 30);
    const second = state.replayCommandResult('s', requestId, 40);
    assert.equal(first.replayed, true);
    assert.equal(second.replayed, true);
    assert.equal(second.entry.replayCount, 2);
    assert.deepEqual(second.result.memberIds, ['q1', 'q2']);
  }
});
