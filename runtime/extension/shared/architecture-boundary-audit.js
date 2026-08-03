const OWNER_RULES = Object.freeze({
  background: new Set(['background','shared']),
  content: new Set(['content','shared']),
  dashboard: new Set(['dashboard','shared']),
  shared: new Set(['shared'])
});

export function architectureOwner(modulePath = '') {
  const normalized = String(modulePath || '').replaceAll('\\', '/');
  const value = normalized.startsWith('./') ? normalized.slice(2) : normalized;
  if (value === 'background.js') return 'background';
  if (value.startsWith('content/')) return 'content';
  if (value.startsWith('dashboard/')) return 'dashboard';
  if (value.startsWith('shared/')) return 'shared';
  return 'other';
}

export function auditArchitectureBoundaries(modules = []) {
  const violations = [];
  for (const module of Array.isArray(modules) ? modules : []) {
    const from = String(module?.path || '').replaceAll('\\','/');
    const fromOwner = architectureOwner(from);
    if (!OWNER_RULES[fromOwner]) continue;
    for (const target of Array.isArray(module?.imports) ? module.imports : []) {
      const to = String(target || '').replaceAll('\\','/');
      const toOwner = architectureOwner(to);
      if (toOwner !== 'other' && !OWNER_RULES[fromOwner].has(toOwner)) {
        violations.push({ code:'architecture_dependency_reversed', from, fromOwner, to, toOwner });
      }
    }
  }
  return { ok: violations.length === 0, violations, owners:Object.keys(OWNER_RULES) };
}
