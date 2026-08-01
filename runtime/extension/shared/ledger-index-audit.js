export function auditLedgerIndex(index, entries = [], { repair = false } = {}) {
  if (!index?.audit || !index?.rebuild) {
    return { ok: false, rebuilt: false, findings: [{ code: 'index_unavailable' }] };
  }
  const initial = index.audit(entries);
  if (initial.ok || !repair) return { ...initial, rebuilt: false };
  index.rebuild(entries);
  const verified = index.audit(entries);
  return { ...verified, rebuilt: true, previousFindings: initial.findings };
}
