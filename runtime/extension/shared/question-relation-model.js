export function validateQuestionRelation(index = {}, itemId, parentId) {
  const child = String(itemId || '').trim();
  const parent = String(parentId || '').trim();
  if (!child) return { ok: false, error: 'question_id_required' };
  if (!parent) return { ok: true, parentId: '' };
  if (child === parent) return { ok: false, error: 'question_cannot_follow_itself' };
  if (!index[parent]) return { ok: false, error: 'parent_question_missing' };
  const visited = new Set([child]);
  let current = parent;
  while (current) {
    if (visited.has(current)) return { ok: false, error: 'question_relationship_cycle' };
    visited.add(current);
    current = String(index[current]?.parentId || '');
  }
  return { ok: true, parentId: parent };
}

export function deriveQuestionRelations(index = {}) {
  const children = {};
  for (const [id, metadata] of Object.entries(index || {})) {
    const parentId = String(metadata?.parentId || '');
    if (!parentId) continue;
    children[parentId] ||= [];
    children[parentId].push(id);
  }
  return Object.fromEntries(Object.entries(children).map(([id, values]) => [id, values.sort()]));
}
