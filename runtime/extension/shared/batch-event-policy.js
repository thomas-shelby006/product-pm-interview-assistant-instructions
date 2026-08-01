const TRANSIENT_EVENTS = new Set(['batch_accumulated', 'next_batch_draft']);

export function shouldPersistBatchEvent(event) {
  const type = String(event?.type || '');
  return Boolean(type && !TRANSIENT_EVENTS.has(type));
}

export function safeBatchTelemetry(state = null) {
  const value = state && typeof state === 'object' ? state : {};
  const cleanBatch = batch => {
    if (!batch || typeof batch !== 'object') return null;
    const prompt = batch.prompt && typeof batch.prompt === 'object' ? batch.prompt : {};
    const memberIds = Array.isArray(prompt.memberIds)
      ? prompt.memberIds.map(String)
      : Array.isArray(batch.memberIds)
        ? batch.memberIds.map(String)
        : [];
    return {
      batchId: String(batch.id || batch.batchId || ''),
      memberIds,
      questionCount: Number(prompt.questionCount || batch.questionCount || memberIds.length),
      focusId: String(prompt.focusId || batch.focusId || ''),
      fingerprint: String(prompt.fingerprint || batch.fingerprint || ''),
      submittedAt: Number(batch.submittedAt || 0)
    };
  };
  const next = value.next && typeof value.next === 'object'
    ? {
        memberIds: Array.isArray(value.next.prompt?.memberIds)
          ? value.next.prompt.memberIds.map(String)
          : [],
        questionCount: Number(value.next.prompt?.questionCount || value.next.count || 0),
        focusId: String(value.next.prompt?.focusId || ''),
        fingerprint: String(value.next.prompt?.fingerprint || '')
      }
    : null;
  return {
    active: cleanBatch(value.active),
    next,
    hold: Boolean(value.hold),
    autoSubmit: value.autoSubmit !== false
  };
}
