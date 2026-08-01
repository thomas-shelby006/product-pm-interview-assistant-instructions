function landmarkFromMarker(marker = {}) {
  return {
    id: String(marker.id || ''),
    type: marker.source === 'operator' ? 'operator_marker' : 'activity_marker',
    category: String(marker.category || 'event'),
    at: Math.max(0, Number(marker.createdAt || 0)),
    targetType: String(marker.targetType || 'session'),
    targetId: String(marker.targetId || ''),
    source: String(marker.source || 'runtime')
  };
}

export function deriveSessionLandmarks({ timeline = [], operatorMarkers = [], activityMarkers = [] } = {}) {
  const phaseEvents = (Array.isArray(timeline) ? timeline : []).filter(item => ['live_session_phase', 'transport_mode', 'answer_terminal', 'receiver_batch_event'].includes(String(item?.type || ''))).map((item, index) => ({
    id: `timeline:${item.type}:${item.at}:${index}`,
    type: 'timeline',
    category: String(item.type || ''),
    at: Math.max(0, Number(item.at || 0)),
    targetType: item.data?.batchId ? 'batch' : item.data?.itemId ? 'envelope' : 'session',
    targetId: String(item.data?.batchId || item.data?.itemId || item.data?.phase || ''),
    source: 'timeline'
  }));
  const combined = [...phaseEvents, ...operatorMarkers.map(landmarkFromMarker), ...activityMarkers.map(landmarkFromMarker)];
  const deduped = new Map();
  for (const item of combined) deduped.set(item.id, item);
  return [...deduped.values()].sort((a, b) => a.at - b.at).slice(-240);
}
