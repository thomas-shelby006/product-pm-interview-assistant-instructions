import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';
import { deriveQuestionOperations } from '../shared/question-operations-state.js';
import { validateQuestionRelation } from '../shared/question-relation-model.js';
import { deriveBatchPreview } from '../shared/batch-preview-model.js';
import { applyPriorityEmphasis } from '../shared/priority-emphasis.js';
import { buildQuestionQueryIndex, queryQuestions } from '../shared/question-query-index.js';

test('Cycle 111 pin priority and defer metadata never mutate delivery sequence', () => {
  const state = new RuntimePilotState([{ sessionId: 's1', ledger: [
    { id: 'q1', state: 'persisted', envelope: { id: 'q1', seq: 1, text: 'one' } },
    { id: 'q2', state: 'persisted', envelope: { id: 'q2', seq: 2, text: 'two' } }
  ] }]);
  state.updateQuestionMetadata('s1', 'q2', { pinned: true, priority: 'critical', deferCondition: 'manual' }, 'triage', 10);
  const snapshot = state.snapshot('s1', 20);
  const derived = deriveQuestionOperations(snapshot, 20);
  assert.deepEqual(derived.questions.map(item => item.id), ['q1', 'q2']);
  assert.equal(derived.questions[1].operator.priority, 'critical');
  assert.equal(derived.sequencePreserved, true);
});

test('Cycle 112 follow-up validation rejects self links missing parents and cycles', () => {
  const index = { q1: {}, q2: { parentId: 'q1' } };
  assert.equal(validateQuestionRelation(index, 'q1', 'q1').error, 'question_cannot_follow_itself');
  assert.equal(validateQuestionRelation(index, 'q1', 'missing').error, 'parent_question_missing');
  assert.equal(validateQuestionRelation(index, 'q1', 'q2').error, 'question_relationship_cycle');
  assert.equal(validateQuestionRelation(index, 'q2', 'q1').ok, true);
});

test('Cycle 113 batch preview exposes exact active and next membership and provider budget', () => {
  const preview = deriveBatchPreview({
    ledger: [
      { id: 'q1', state: 'submitted', envelope: { seq: 1, text: 'one' } },
      { id: 'q2', state: 'persisted', envelope: { seq: 2, text: 'two' } }
    ],
    batchState: {
      active: { id: 'b1', memberIds: ['q1'] },
      next: { id: 'b2', memberIds: ['q2'] },
      budget: { provider: 'chatgpt', maxMembers: 8, maxChars: 12000 },
      autoSubmit: true
    }
  });
  assert.deepEqual(preview.active.memberIds, ['q1']);
  assert.deepEqual(preview.next.memberIds, ['q2']);
  assert.equal(preview.sequencePreserved, true);
  assert.equal(preview.budget.maxChars, 12000);
});

test('Cycle 114 search uses an ephemeral index and filters metadata without changing source order', () => {
  const questions = [
    { id: 'q1', state: 'persisted', envelope: { text: 'activation metric' }, status: { group: 'waiting', actionable: true }, operator: { priority: 'high', pinned: true } },
    { id: 'q2', state: 'proven', envelope: { text: 'retention risk' }, status: { group: 'proven', actionable: false }, operator: { priority: 'normal', pinned: false } }
  ];
  const index = buildQuestionQueryIndex(questions);
  assert.deepEqual(queryQuestions(index, 'activation', { pinned: true }).map(item => item.id), ['q1']);
  assert.deepEqual(questions.map(item => item.id), ['q1', 'q2']);
});

test('Cycle 115 priority emphasis highlights urgency but preserves immutable order', () => {
  const result = applyPriorityEmphasis([
    { id: 'q1', operator: { priority: 'normal' } },
    { id: 'q2', operator: { priority: 'critical', pinned: true } }
  ], 100);
  assert.deepEqual(result.questions.map(item => item.id), ['q1', 'q2']);
  assert.equal(result.questions[1].emphasis.level, 'pinned');
  assert.equal(result.sequencePreserved, true);
});

test('question metadata undo is single-use and state-export safe', () => {
  const state = new RuntimePilotState([{ sessionId: 's1', ledger: [{ id: 'q1', state: 'persisted', envelope: { id: 'q1', seq: 1, text: 'one' } }] }]);
  const change = state.updateQuestionMetadata('s1', 'q1', { priority: 'high' }, 'priority', 10);
  const undo = state.undoQuestionMetadata('s1', change.undo.id, 11);
  assert.equal(undo.ok, true);
  assert.equal(state.undoQuestionMetadata('s1', change.undo.id, 12).ok, false);
  const restored = new RuntimePilotState(state.exportState()).snapshot('s1', 13);
  assert.equal(restored.questionOperations.metadata.q1.priority, 'normal');
});
