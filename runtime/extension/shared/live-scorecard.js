export function deriveLiveScorecard(snapshot = {}) {
  const markers = Array.isArray(snapshot.operatorMarkers) ? snapshot.operatorMarkers : [];
  const markerCounts = markers.reduce((out, item) => { const key=String(item.category||'other'); out[key]=(out[key]||0)+1; return out; }, {});
  const history = snapshot.liveSession?.history || [];
  const phases = [...new Set(history.map(item => String(item.phase || item.to || '')).filter(Boolean))];
  const metrics = snapshot.metrics || {};
  const questions = snapshot.questionOperationsDerived?.questions || [];
  const followUps = questions.filter(item => item.relationship?.parentId).length;
  const deferred = questions.filter(item => item.operator?.defer?.condition && item.operator.defer.condition !== 'none').length;
  const pinned = questions.filter(item => item.operator?.pinned).length;
  const unresolved = Number(snapshot.ledgerCounts?.pending || 0) + Number(snapshot.ledgerCounts?.failed || 0) + Number(snapshot.ledgerCounts?.inFlight || 0);
  const score = Math.max(0, Math.min(100, Math.round((Number(metrics.deliverySuccessRate ?? 100) * 0.45) + (Number(metrics.answerAvailabilityRate ?? 100) * 0.35) + (Math.min(5, phases.length) / 5 * 20))));
  return { score, markerCounts, markerTotal: markers.length, phases, phaseCount: phases.length, questionsObserved: Number(metrics.finalsObserved || questions.length), delivered: Number(metrics.delivered || 0), answerAvailabilityRate: Number(metrics.answerAvailabilityRate ?? 100), deliverySuccessRate: Number(metrics.deliverySuccessRate ?? 100), followUps, deferred, pinned, unresolved, reviewReady: unresolved === 0 && snapshot.liveSession?.phase === 'debrief' };
}
