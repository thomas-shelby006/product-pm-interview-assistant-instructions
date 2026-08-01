export function deriveCompactionHorizon(entries = [], { now = Date.now(), retainMs = 30 * 60 * 1000, retainProven = 200, tombstones = [] } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const proven = list.filter(item => item.state === 'proven' || item.state === 'archived').sort((a, b) => Number(a.updatedAt || a.provenAt || 0) - Number(b.updatedAt || b.provenAt || 0));
  const protectedIds = new Set(list.filter(item => !['proven','archived'].includes(item.state)).map(item => String(item.id)));
  const recentIds = new Set(proven.slice(-Math.max(0, Number(retainProven) || 0)).map(item => String(item.id)));
  const compactable = proven.filter(item => !protectedIds.has(String(item.id)) && !recentIds.has(String(item.id)) && now - Number(item.updatedAt || item.provenAt || 0) >= retainMs && !(tombstones || []).some(stone => stone.id === item.id));
  const horizonAt = compactable.length ? Math.max(...compactable.map(item => Number(item.updatedAt || item.provenAt || 0))) : 0;
  return { compactableIds: compactable.map(item => String(item.id)), protectedCount: protectedIds.size, retainedRecentCount: recentIds.size, horizonAt, safe: compactable.every(item => ['proven','archived'].includes(item.state)) };
}
