const URGENCY = new Set(['normal', 'elevated', 'critical']);

export function normalizeQuestionTriage(value = {}) {
  return {
    pinned: Boolean(value.pinned),
    deferred: Boolean(value.deferred),
    urgency: URGENCY.has(String(value.urgency)) ? String(value.urgency) : 'normal',
    reason: String(value.reason || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80),
    updatedAt: Math.max(0, Number(value.updatedAt || 0))
  };
}

export function triageToQuestionMetadata(value = {}) {
  const triage = normalizeQuestionTriage(value);
  return {
    pinned: triage.pinned,
    priority: triage.urgency === 'critical' ? 'critical' : triage.urgency === 'elevated' ? 'high' : 'normal',
    deferCondition: triage.deferred ? 'manual' : 'none',
    deferUntil: 0
  };
}

export function setQuestionTriage(map = {}, ledgerItemId, value = {}) {
  const id = String(ledgerItemId || '').trim();
  return id ? { ...map, [id]: normalizeQuestionTriage(value) } : { ...map };
}

export function clearQuestionTriage(map = {}, ledgerItemId) {
  const next = { ...map };
  delete next[String(ledgerItemId || '')];
  return next;
}

export function projectTriage(ledger = [], map = {}) {
  return ledger.map((item, index) => ({ ...item, triage: normalizeQuestionTriage(map[item.id] || {}), deliveryOrder: index }));
}
