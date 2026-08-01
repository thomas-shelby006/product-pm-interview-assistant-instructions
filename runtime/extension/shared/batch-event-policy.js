const TRANSIENT_EVENTS = new Set(['batch_accumulated', 'next_batch_draft', 'batch_schedule_evaluated']);

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
        fingerprint: String(value.next.prompt?.fingerprint || ''),
        protectedCount: Number(value.next.protectedCount || value.next.count || 0),
        partitionCount: Number(value.next.partitionCount || 0),
        firstPartitionCount: Number(value.next.firstPartitionCount || value.next.prompt?.questionCount || 0),
        remainingCount: Number(value.next.remainingCount || 0)
      }
    : null;
  const cleanTransaction = transaction => transaction && typeof transaction === 'object' ? {
    batchId: String(transaction.batchId || ''),
    memberIds: Array.isArray(transaction.memberIds) ? transaction.memberIds.map(String) : [],
    state: String(transaction.state || ''),
    updatedAt: Number(transaction.updatedAt || 0),
    reason: String(transaction.reason || '')
  } : null;
  return {
    active: cleanBatch(value.active),
    next,
    hold: Boolean(value.hold),
    autoSubmit: value.autoSubmit !== false,
    transaction: cleanTransaction(value.transaction),
    lastTransaction: cleanTransaction(value.lastTransaction),
    budget: value.budget && typeof value.budget === 'object' ? {
      maxMembers: Math.max(1, Number(value.budget.maxMembers) || 1),
      maxChars: Math.max(256, Number(value.budget.maxChars) || 256)
    } : null,
    scheduling: value.scheduling && typeof value.scheduling === 'object' ? {
      memberIds: Array.isArray(value.scheduling.memberIds) ? value.scheduling.memberIds.map(String) : [],
      urgency: String(value.scheduling.urgency || ''),
      reason: String(value.scheduling.reason || ''),
      ageMs: Math.max(0, Number(value.scheduling.ageMs) || 0),
      submitRecommended: Boolean(value.scheduling.submitRecommended),
      evaluatedAt: Number(value.scheduling.evaluatedAt || 0)
    } : null
  };
}
