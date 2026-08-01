export function addWakeHistory(history = [], event = {}, limit = 80) {
  const value = { reason: String(event.reason || 'unknown'), source: String(event.source || ''), sessionId: String(event.sessionId || ''), at: Math.max(0, Number(event.at || Date.now())), generation: Math.max(0, Number(event.generation || 0)), outcome: String(event.outcome || '') };
  const list = Array.isArray(history) ? history.filter(item => !(item.reason === value.reason && item.source === value.source && item.generation === value.generation && item.outcome === value.outcome)) : [];
  list.push(value);
  return list.slice(-Math.max(1, Number(limit) || 80));
}

export function summarizeWakeHistory(history = []) {
  const counts = {};
  for (const item of Array.isArray(history) ? history : []) counts[item.reason] = (counts[item.reason] || 0) + 1;
  return { total: (history || []).length, counts, latest: history?.at?.(-1) || null };
}
