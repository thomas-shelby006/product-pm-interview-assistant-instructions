import { deriveQuestionOperations } from '../shared/question-operations-state.js';
import { buildQuestionQueryIndex, inspectQuestion, queryQuestions } from '../shared/question-query-index.js';

export function deriveQuestionNavigator(snapshot = {}, value = {}, now = Date.now()) {
  const operations = snapshot.questionOperationsDerived || deriveQuestionOperations(snapshot, now);
  const query = String(value.query || '');
  const filters = {
    group: String(value.group || 'all'),
    priority: String(value.priority || 'all'),
    pinned: Boolean(value.pinned),
    actionable: Boolean(value.actionable)
  };
  const index = buildQuestionQueryIndex(operations.questions);
  const results = queryQuestions(index, query, filters);
  const selectedId = results.some(item => item.id === value.selectedId)
    ? value.selectedId : (results[0]?.id || '');
  return {
    query, filters, results, selectedId,
    selected: inspectQuestion(operations.questions, selectedId),
    counts: operations.counts,
    latestUndo: operations.latestUndo,
    sequencePreserved: operations.sequencePreserved
  };
}

export function questionActionPayload(action, selected, value = {}) {
  const itemId = String(selected?.id || '');
  if (!itemId) return null;
  if (action === 'pin') return { itemId, value: !Boolean(selected.operator?.pinned) };
  if (action === 'priority') return { itemId, priority: String(value.priority || 'normal') };
  if (action === 'defer') return { itemId, condition: String(value.condition || 'manual'), until: Math.max(0, Number(value.until || 0)) };
  if (action === 'link') return { itemId, parentId: String(value.parentId || '') };
  return null;
}
