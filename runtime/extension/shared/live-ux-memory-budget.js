const DEFAULTS = Object.freeze({ commandIndex: 160, questionIndex: 500, visibleQueue: 120, timeline: 200, traces: 160, idleTasks: 40 });

export function deriveLiveUxMemoryBudget(snapshot = {}, limits = {}) {
  const budget = { ...DEFAULTS, ...(limits || {}) };
  const usage = {
    commandIndex: Math.max(0, Number(snapshot.liveUxUsage?.commandIndex || 0)),
    questionIndex: Math.max(0, Number(snapshot.questionOperationsDerived?.questions?.length || 0)),
    visibleQueue: Math.max(0, Number(snapshot.ledger?.length || 0)),
    timeline: Math.max(0, Number(snapshot.timeline?.length || 0)),
    traces: Math.max(0, Number(snapshot.traceSpans?.length || 0)),
    idleTasks: Math.max(0, Number(snapshot.liveUxUsage?.idleTasks || 0))
  };
  const breaches = Object.entries(usage).filter(([key, value]) => value > Number(budget[key] || Infinity)).map(([key, value]) => ({ key, value, limit: budget[key] }));
  return { state: breaches.length ? 'over_budget' : 'within_budget', budget, usage, breaches, actions: breaches.map(item => item.key === 'timeline' ? 'compact_transient' : item.key === 'visibleQueue' ? 'virtualize_queue' : 'rebuild_index_idle') };
}

export function clampLiveUxCollection(values = [], limit = 100) {
  const list = Array.isArray(values) ? values : [];
  return list.length > limit ? list.slice(-Math.max(1, Number(limit) || 100)) : list.slice();
}
