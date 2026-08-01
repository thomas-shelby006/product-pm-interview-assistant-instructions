import { normalizeQuestionMetadataIndex } from './question-metadata-index.js';
import { deriveQuestionStatus } from './question-status-model.js';
import { explainDuplicate } from './duplicate-decision-model.js';
import { latestUndo, normalizeUndoJournal } from './operator-undo-journal.js';
import { applyPriorityEmphasis } from './priority-emphasis.js';

export function deriveQuestionOperations(snapshot = {}, now = Date.now()) {
  const metadata = normalizeQuestionMetadataIndex(snapshot.questionOperations?.metadata || {});
  const ledger = Array.isArray(snapshot.ledger) ? snapshot.ledger : [];
  const questions = ledger.map((entry, deliveryOrder) => {
    const status = deriveQuestionStatus(entry, snapshot);
    const operator = metadata[entry.id] || {};
    return {
      ...entry,
      deliveryOrder,
      status,
      operator,
      duplicate: explainDuplicate(entry.id, snapshot.timeline || []),
      relationship: operator.parentId ? { type: 'follow_up', parentId: operator.parentId } : null,
      deferred: operator.deferCondition && operator.deferCondition !== 'none',
      deferReady: operator.deferCondition === 'until_time' ? Number(operator.deferUntil || 0) <= now : operator.deferCondition === 'after_current_answer' ? !snapshot.batchState?.active : operator.deferCondition !== 'manual'
    };
  });
  const emphasized = applyPriorityEmphasis(questions, now);
  const groups = Object.fromEntries(['current', 'waiting', 'proven', 'archived'].map(group => [group, emphasized.questions.filter(item => item.status.group === group)]));
  return {
    questions: emphasized.questions,
    groups,
    counts: Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, values.length])),
    pinnedIds: questions.filter(item => item.operator.pinned).map(item => item.id),
    latestUndo: latestUndo(snapshot.questionOperations?.undoJournal || [], now),
    undoJournal: normalizeUndoJournal(snapshot.questionOperations?.undoJournal || []),
    sequencePreserved: emphasized.sequencePreserved
  };
}
