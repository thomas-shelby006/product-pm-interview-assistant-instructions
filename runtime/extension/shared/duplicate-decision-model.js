export function buildDuplicateDecisionIndex(timeline = []) {
  const output = new Map();
  for (const event of Array.isArray(timeline) ? timeline : []) {
    const data = event?.data || {};
    if (!data.duplicate && !String(event?.type || '').includes('duplicate')) continue;
    const id = String(data.envelopeId || data.ledgerItemId || data.id || '');
    if (!id) continue;
    const prior = output.get(id) || { count: 0, reasons: [], retainedId: id, lastAt: 0 };
    const reason = String(data.reason || event.type || 'duplicate');
    output.set(id, {
      count: prior.count + 1,
      reasons: [...new Set([...prior.reasons, reason])].slice(-8),
      retainedId: String(data.retainedId || data.existingId || prior.retainedId || id),
      lastAt: Math.max(prior.lastAt, Number(event.at || 0))
    });
  }
  return output;
}

export function explainDuplicate(itemId, timeline = []) {
  const value = buildDuplicateDecisionIndex(timeline).get(String(itemId || ''));
  return value ? {
    duplicate: true,
    count: value.count,
    reason: value.reasons.at(-1) || 'duplicate',
    reasons: [...value.reasons],
    retainedId: value.retainedId,
    lastAt: value.lastAt
  } : { duplicate: false, count: 0, reason: '', reasons: [], retainedId: '', lastAt: 0 };
}
