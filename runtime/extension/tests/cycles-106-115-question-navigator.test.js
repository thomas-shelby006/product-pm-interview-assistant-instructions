import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RuntimePilotState } from '../shared/runtime-pilot-state.js';
import { updateQuestionMetadata } from '../shared/question-metadata-index.js';
import { deriveQuestionStatus } from '../shared/question-status-model.js';
import { deriveQuestionOperations } from '../shared/question-operations-state.js';
import { buildDuplicateDecisionIndex, explainDuplicate } from '../shared/duplicate-decision-model.js';
import { buildQuestionQueryIndex, inspectQuestion, queryQuestions } from '../shared/question-query-index.js';
import { consumeUndo, latestUndo, recordUndo } from '../shared/operator-undo-journal.js';
import { deriveQuestionNavigator } from '../dashboard/question-navigator-model.js';

function envelope(id, seq, text = `Question ${seq}`) {
  return { id, sessionId: 's1', sourceProvider: 'chatgpt', kind: 'question', seq, text, metadata: { traceId: `trace-${seq}` }, createdAt: seq };
}

function stateWithQuestions() {
  const state = new RuntimePilotState([{ sessionId: 's1', createdAt: 1 }]);
  state.persistFinal('s1', envelope('q1', 1), 10);
  state.persistFinal('s1', envelope('q2', 2), 20);
  return state;
}

test('Cycle 106 groups current, waiting, proven, and archived without reordering', () => {
  const snapshot = { ledger: [
    { id: 'q1', state: 'submitted', envelope: envelope('q1', 1) },
    { id: 'q2', state: 'persisted', envelope: envelope('q2', 2) },
    { id: 'q3', state: 'proven', envelope: envelope('q3', 3) },
    { id: 'q4', state: 'archived', envelope: envelope('q4', 4) }
  ], batchState: { active: { memberIds: ['q1'] }, next: { memberIds: ['q2'] } }, questionOperations: {} };
  const result = deriveQuestionOperations(snapshot, 100);
  assert.deepEqual(result.questions.map(item => item.id), ['q1', 'q2', 'q3', 'q4']);
  assert.deepEqual(result.counts, { current: 1, waiting: 1, proven: 1, archived: 1 });
  assert.equal(result.sequencePreserved, true);
});

test('Cycles 107-109 pin, defer, and priority are metadata-only', () => {
  let result = updateQuestionMetadata({}, 'q1', { pinned: true, priority: 'critical', deferCondition: 'manual' }, 10);
  assert.equal(result.ok, true);
  assert.equal(result.after.pinned, true);
  assert.equal(result.after.priority, 'critical');
  assert.equal(result.after.deferCondition, 'manual');
  const state = stateWithQuestions();
  state.updateQuestionMetadata('s1', 'q2', result.after, 'triage', 30);
  assert.deepEqual(state.snapshot('s1', 30).ledger.map(item => item.id), ['q1', 'q2']);
});

test('Cycle 110 follow-up relationship is reversible metadata', () => {
  const change = updateQuestionMetadata({}, 'q2', { parentId: 'q1' }, 20);
  assert.equal(change.after.parentId, 'q1');
  const journal = recordUndo([], { action: 'relationship', itemId: 'q2', before: change.before, after: change.after }, 20);
  const undo = consumeUndo(journal, journal[0].id, 30);
  assert.equal(undo.ok, true);
  assert.equal(undo.entry.before.parentId, '');
});

test('Cycle 111 explains duplicate decisions using retained identity', () => {
  const timeline = [{ type: 'delivery_outcome', at: 20, data: { duplicate: true, envelopeId: 'q1', retainedId: 'q1', reason: 'duplicate_sequence' } }];
  const index = buildDuplicateDecisionIndex(timeline);
  assert.equal(index.get('q1').count, 1);
  const explanation = explainDuplicate('q1', timeline);
  assert.equal(explanation.duplicate, true);
  assert.equal(explanation.retainedId, 'q1');
});

test('Cycle 112 canonical status is identical across navigator projections', () => {
  const entry = { id: 'q1', state: 'persisted' };
  const status = deriveQuestionStatus(entry, { batchState: { next: { memberIds: ['q1'] } } });
  assert.equal(status.label, 'Next batch');
  assert.equal(status.group, 'waiting');
  assert.equal(status.actionable, true);
});

test('Cycles 113-114 indexed search and inspector preserve exact selected question', () => {
  const questions = [
    { id: 'q1', state: 'persisted', status: { group: 'waiting' }, operator: { priority: 'critical', pinned: true }, envelope: envelope('q1', 1, 'Activation metric') },
    { id: 'q2', state: 'proven', status: { group: 'proven' }, operator: { priority: 'normal' }, envelope: envelope('q2', 2, 'Retention metric') }
  ];
  const result = queryQuestions(buildQuestionQueryIndex(questions), 'activation critical', { group: 'waiting', pinned: true });
  assert.deepEqual(result.map(item => item.id), ['q1']);
  assert.equal(inspectQuestion(questions, 'q1').traceId, 'trace-1');
});

test('Cycle 115 bounded undo is one-use and expires', () => {
  const journal = recordUndo([], { action: 'pin', itemId: 'q1', before: { pinned: false }, after: { pinned: true } }, 100, 1000);
  assert.equal(latestUndo(journal, 500).id, journal[0].id);
  const used = consumeUndo(journal, journal[0].id, 500);
  assert.equal(used.ok, true);
  assert.equal(consumeUndo(used.journal, journal[0].id, 600).ok, false);
  assert.equal(latestUndo(journal, 1200), null);
});

test('Cycles 106-115 navigator is packaged with filters, inspector, commands, and undo', async () => {
  const [html, script, protocol] = await Promise.all([
    readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('../shared/dashboard-protocol.js', import.meta.url), 'utf8')
  ]);
  for (const id of ['questionSearch', 'questionGroup', 'questionPriority', 'questionPinned', 'questionInspector', 'undoQuestionAction']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(script, /deriveQuestionNavigator/);
  assert.match(script, /set_question_pin/);
  assert.match(script, /link_question_follow_up/);
  for (const command of ['set_question_pin', 'defer_question', 'set_question_priority', 'link_question_follow_up', 'undo_question_action']) {
    assert.match(protocol, new RegExp(`'${command}'`));
  }
});

test('question navigator does not mutate ledger order when filters change', () => {
  const snapshot = { ledger: [
    { id: 'q1', state: 'persisted', envelope: envelope('q1', 1) },
    { id: 'q2', state: 'persisted', envelope: envelope('q2', 2) }
  ], batchState: {}, questionOperations: { metadata: { q2: { priority: 'critical', pinned: true } } } };
  const navigator = deriveQuestionNavigator(snapshot, { priority: 'critical', pinned: true }, 100);
  assert.deepEqual(navigator.results.map(item => item.id), ['q2']);
  assert.deepEqual(snapshot.ledger.map(item => item.id), ['q1', 'q2']);
  assert.equal(navigator.sequencePreserved, true);
});
