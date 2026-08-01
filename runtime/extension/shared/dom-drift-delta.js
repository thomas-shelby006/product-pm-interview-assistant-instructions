export function deriveDomDriftDelta(previous = {}, current = {}, now = Date.now()) {
  const surfaces = [...new Set([...Object.keys(previous || {}), ...Object.keys(current || {})])].sort();
  const changed = [];
  for (const surface of surfaces) {
    const before = previous?.[surface] || {};
    const after = current?.[surface] || {};
    const beforeSelector = String(before.selector || '');
    const afterSelector = String(after.selector || '');
    const beforeFound = Boolean(before.found);
    const afterFound = Boolean(after.found);
    if (beforeSelector !== afterSelector || beforeFound !== afterFound) changed.push({ surface, beforeSelector, afterSelector, beforeFound, afterFound, severity: beforeFound && !afterFound ? 'critical' : 'info' });
  }
  return { changed: changed.length > 0, changes: changed, critical: changed.filter(item => item.severity === 'critical'), observedAt: now };
}
