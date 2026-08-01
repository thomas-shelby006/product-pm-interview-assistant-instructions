function normalize(value) { return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

export function buildQuestionQueryIndex(questions = []) {
  return questions.map(item => ({
    id: item.id,
    text: normalize([
      item.id, item.envelope?.seq, item.state, item.status?.label, item.status?.group,
      item.batchId, item.operator?.priority, item.operator?.pinned ? 'pinned' : '',
      item.operator?.deferCondition, item.relationship?.parentId, item.envelope?.text
    ].join(' ')),
    item
  }));
}

export function queryQuestions(index = [], query = '', filters = {}) {
  const words = normalize(query).split(' ').filter(Boolean);
  return index.filter(entry => {
    const item = entry.item;
    if (words.some(word => !entry.text.includes(word))) return false;
    if (filters.group && filters.group !== 'all' && item.status?.group !== filters.group) return false;
    if (filters.priority && filters.priority !== 'all' && item.operator?.priority !== filters.priority) return false;
    if (filters.pinned && !item.operator?.pinned) return false;
    if (filters.actionable && !item.status?.actionable) return false;
    return true;
  }).map(entry => entry.item);
}

export function inspectQuestion(questions = [], itemId = '') {
  const item = questions.find(value => value.id === String(itemId || ''));
  if (!item) return null;
  return {
    id: item.id,
    seq: Number(item.envelope?.seq || 0),
    state: item.state,
    status: item.status,
    batchId: String(item.batchId || ''),
    traceId: String(item.envelope?.metadata?.traceId || ''),
    operator: { ...(item.operator || {}) },
    relationship: item.relationship ? { ...item.relationship } : null,
    duplicate: { ...(item.duplicate || {}) },
    persistedAt: Number(item.persistedAt || 0),
    updatedAt: Number(item.updatedAt || 0),
    text: String(item.envelope?.text || '')
  };
}
