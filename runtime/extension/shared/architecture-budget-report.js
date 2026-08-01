export function buildArchitectureBudgetReport({ modules = [], limits = {} } = {}) {
  const budget = { maxLinesPerOwner: 1400, maxImportsPerModule: 28, maxDashboardOwnerLines: 1800, maxControllerLines: 2200, ...limits };
  const values = (Array.isArray(modules) ? modules : []).map(item => ({ path: String(item.path || ''), lines: Math.max(0, Number(item.lines || 0)), imports: Math.max(0, Number(item.imports || 0)), owner: String(item.owner || '') }));
  const violations = [];
  for (const item of values) {
    const lineLimit = item.owner === 'dashboard' ? budget.maxDashboardOwnerLines : item.owner === 'controller' ? budget.maxControllerLines : budget.maxLinesPerOwner;
    if (item.lines > lineLimit) violations.push({ code: 'module_line_budget', path: item.path, value: item.lines, limit: lineLimit });
    if (item.imports > budget.maxImportsPerModule) violations.push({ code: 'module_import_budget', path: item.path, value: item.imports, limit: budget.maxImportsPerModule });
  }
  return { ok: violations.length === 0, budget, modules: values, violations, totals: { modules: values.length, lines: values.reduce((sum, item) => sum + item.lines, 0), imports: values.reduce((sum, item) => sum + item.imports, 0) } };
}
