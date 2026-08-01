const ALLOWED = new Set(['follow_up', 'strong_answer', 'weak_answer', 'needs_review', 'metric_gap', 'execution_gap']);

function normalize(value = {}) {
  const category = String(value.category || 'needs_review');
  if (!ALLOWED.has(category)) return null;
  const targetType = ['trace', 'envelope', 'batch', 'session'].includes(String(value.targetType)) ? value.targetType : 'session';
  const targetId = String(value.targetId || '').slice(0, 160);
  return {
    id: String(value.id || `${targetType}:${targetId || 'session'}:${category}`),
    category, targetType, targetId,
    createdAt: Math.max(0, Number(value.createdAt || Date.now())),
    source: String(value.source || 'operator').slice(0, 40)
  };
}

export function addOperatorMarker(markers = [], value = {}) {
  const marker = normalize(value);
  if (!marker) return markers.slice(-100);
  const output = markers.filter(item => item.id !== marker.id);
  output.push(marker);
  return output.sort((a, b) => a.createdAt - b.createdAt).slice(-100);
}

export function removeOperatorMarker(markers = [], id = '') {
  return markers.filter(item => item.id !== String(id || '')).slice(-100);
}

export function filterOperatorMarkers(markers = [], { category = '', targetType = '', targetId = '' } = {}) {
  return markers.filter(item => (!category || item.category === category)
    && (!targetType || item.targetType === targetType)
    && (!targetId || item.targetId === targetId));
}

export function markerSummary(markers = []) {
  const counts = {};
  for (const marker of markers) counts[marker.category] = (counts[marker.category] || 0) + 1;
  return { total: markers.length, counts };
}
