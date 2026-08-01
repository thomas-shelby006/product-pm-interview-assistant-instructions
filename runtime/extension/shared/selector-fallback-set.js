export function normalizeSelectorFallbackSet(value = {}) {
  const entries = Object.entries(value && typeof value === 'object' ? value : {}).map(([surface, selectors]) => [String(surface), [...new Set((Array.isArray(selectors) ? selectors : [selectors]).map(String).filter(Boolean))]]).filter(([, selectors]) => selectors.length);
  return Object.fromEntries(entries);
}

export function mergeSelectorFallbackSets(base = {}, update = {}) {
  const left = normalizeSelectorFallbackSet(base);
  const right = normalizeSelectorFallbackSet(update);
  const output = { ...left };
  for (const [surface, selectors] of Object.entries(right)) output[surface] = [...new Set([...(output[surface] || []), ...selectors])];
  return output;
}

export function prioritizeSelector(set = {}, surface = '', selector = '') {
  const normalized = normalizeSelectorFallbackSet(set);
  const values = normalized[surface] || [];
  if (!values.includes(selector)) return normalized;
  normalized[surface] = [selector, ...values.filter(value => value !== selector)];
  return normalized;
}
