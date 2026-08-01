const PRIORITIES = new Set(['low', 'normal', 'high', 'critical']);
const DEFER_CONDITIONS = new Set(['none', 'after_current_answer', 'manual', 'until_time']);

export function normalizeQuestionMetadata(value = {}) {
  return {
    pinned: Boolean(value.pinned),
    priority: PRIORITIES.has(String(value.priority)) ? String(value.priority) : 'normal',
    deferCondition: DEFER_CONDITIONS.has(String(value.deferCondition)) ? String(value.deferCondition) : 'none',
    deferUntil: Math.max(0, Number(value.deferUntil || 0)),
    parentId: String(value.parentId || '').slice(0, 160),
    updatedAt: Math.max(0, Number(value.updatedAt || 0)),
    updatedBy: String(value.updatedBy || 'operator').slice(0, 40)
  };
}

export function normalizeQuestionMetadataIndex(value = {}) {
  const output = {};
  for (const [id, metadata] of Object.entries(value && typeof value === 'object' ? value : {})) {
    const key = String(id || '').trim();
    if (key) output[key] = normalizeQuestionMetadata(metadata);
  }
  return output;
}

export function updateQuestionMetadata(index = {}, itemId, patch = {}, now = Date.now()) {
  const id = String(itemId || '').trim();
  if (!id) return { ok: false, error: 'question_id_required', index: normalizeQuestionMetadataIndex(index) };
  const normalized = normalizeQuestionMetadataIndex(index);
  const before = normalizeQuestionMetadata(normalized[id] || {});
  const after = normalizeQuestionMetadata({ ...before, ...patch, updatedAt: now, updatedBy: patch.updatedBy || 'operator' });
  return { ok: true, itemId: id, before, after, index: { ...normalized, [id]: after } };
}

export function removeQuestionMetadata(index = {}, itemId) {
  const output = normalizeQuestionMetadataIndex(index);
  delete output[String(itemId || '')];
  return output;
}
