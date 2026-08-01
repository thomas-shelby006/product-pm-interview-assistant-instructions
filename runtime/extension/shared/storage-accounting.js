const ACTIONABLE = new Set(['persisted', 'staged', 'submitting', 'failed']);

export function utf8Bytes(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

export function estimateStorageCategories(state = []) {
  const sessions = Array.isArray(state) ? state : [];
  const categories = { actionable: 0, proven: 0, telemetry: 0, snapshots: 0, total: 0 };
  for (const session of sessions) {
    for (const entry of Array.isArray(session?.ledger) ? session.ledger : []) {
      const bytes = utf8Bytes(entry);
      if (ACTIONABLE.has(entry?.state)) categories.actionable += bytes;
      else categories.proven += bytes;
    }
    categories.telemetry += utf8Bytes({
      timeline: session?.timeline || [],
      metrics: session?.metrics || {},
      processedCommandIds: session?.processedCommandIds || []
    });
    const snapshot = { ...session, ledger: [], timeline: [], metrics: {}, processedCommandIds: [] };
    categories.snapshots += utf8Bytes(snapshot);
  }
  categories.total = categories.actionable + categories.proven + categories.telemetry + categories.snapshots;
  return categories;
}

export function buildCompactionPlan(categories = {}, targetBytes = 0) {
  let remaining = Math.max(0, Number(categories.total || 0) - Math.max(0, Number(targetBytes) || 0));
  const plan = [];
  for (const category of ['telemetry', 'snapshots', 'proven']) {
    if (!remaining) break;
    const available = Math.max(0, Number(categories[category] || 0));
    const reclaim = Math.min(available, remaining);
    if (reclaim) plan.push({ category, reclaimBytes: reclaim });
    remaining -= reclaim;
  }
  return { plan, remainingBytes: remaining, actionableProtected: true };
}
