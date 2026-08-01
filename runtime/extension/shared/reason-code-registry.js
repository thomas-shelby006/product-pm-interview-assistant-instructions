const REGISTRY = new Map();

export function registerReasonCodes(owner = '', values = []) {
  for (const value of Array.isArray(values) ? values : []) {
    const code = String(value.code || value || '');
    if (!code) continue;
    const existing = REGISTRY.get(code);
    if (existing && existing.owner !== owner) return { ok: false, error: 'reason_code_collision', code, owners: [existing.owner, owner] };
    REGISTRY.set(code, { code, owner: String(owner), severity: String(value.severity || existing?.severity || 'info'), action: String(value.action || existing?.action || '') });
  }
  return { ok: true, count: REGISTRY.size };
}

export function reasonCode(code = '') { return REGISTRY.get(String(code)) ? { ...REGISTRY.get(String(code)) } : null; }
export function reasonCodes() { return [...REGISTRY.values()].sort((a, b) => a.code.localeCompare(b.code)).map(item => ({ ...item })); }
export function auditReasonCodeRegistry(events = []) {
  const unknown = [...new Set((events || []).map(event => String(event?.reason || event?.code || '')).filter(code => code && !REGISTRY.has(code)))];
  return { ok: unknown.length === 0, unknown, registered: REGISTRY.size };
}
