function normalize(value) { return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(); }

export function buildCommandSearchIndex(commands = []) {
  return (Array.isArray(commands) ? commands : []).map((item, order) => ({
    ...item,
    order,
    search: normalize([item.id, item.label, item.group, item.risk, ...(item.keywords || [])].join(' '))
  }));
}

export function searchCommandIndex(index = [], query = '', limit = 40) {
  const terms = normalize(query).split(' ').filter(Boolean);
  const scored = [];
  for (const item of Array.isArray(index) ? index : []) {
    if (terms.some(term => !item.search.includes(term))) continue;
    const id = normalize(item.id); const label = normalize(item.label);
    const score = terms.reduce((sum, term) => sum + (id === term ? 12 : id.startsWith(term) ? 8 : label.startsWith(term) ? 6 : 1), 0);
    scored.push({ ...item, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).slice(0, Math.max(1, Number(limit) || 40));
}
