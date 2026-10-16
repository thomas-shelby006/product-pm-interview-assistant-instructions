const CATEGORIES = new Set(['strong_answer','needs_review','follow_up']);
const FORBIDDEN = ['text','questionText','answerText','prompt','content'];

function clean(value = {}, { rejectText = true } = {}) {
  if (rejectText) {
    for (const key of FORBIDDEN) {
      if (key in value) throw new TypeError('marker payload must be metadata-only');
    }
  }
  const category = String(value.category || '');
  if (!CATEGORIES.has(category)) throw new TypeError('invalid marker category');
  const sessionId = String(value.sessionId || '').trim();
  const turnId = String(value.turnId || '').trim();
  if (!sessionId || !turnId) throw new TypeError('sessionId and turnId are required');
  return { sessionId, turnId, category, at:Number(value.at) || Date.now() };
}

export function normalizeMarkers(values, limit = 50) {
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    try { result.push(clean(value, { rejectText:false })); } catch {}
  }
  return result.slice(-Math.max(0, Number(limit) || 50));
}

export function upsertMarker(values, marker, limit = 50) {
  const next = clean(marker);
  const kept = normalizeMarkers(values, limit).filter(value =>
    !(value.sessionId === next.sessionId && value.turnId === next.turnId && value.category === next.category));
  return [...kept, next].slice(-Math.max(0, Number(limit) || 50));
}

export function markerCounts(values) {
  const counts = { strong_answer:0, needs_review:0, follow_up:0 };
  for (const marker of normalizeMarkers(values, Number.MAX_SAFE_INTEGER)) counts[marker.category] += 1;
  return counts;
}
