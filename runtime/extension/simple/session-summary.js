function roleSummary(stages, role) {
  const rendered = stages.filter(value => value.role === role && value.stage === 'rendered');
  const failed = stages.filter(value => value.role === role && value.stage === 'failed');
  const times = rendered.map(value => Number(value.elapsedMs)).filter(Number.isFinite);
  const total = times.reduce((sum, value) => sum + value, 0);
  return {
    rendered:rendered.length,
    failed:failed.length,
    averageMs:times.length ? Math.round(total / times.length) : null,
    minMs:times.length ? Math.round(Math.min(...times)) : null,
    maxMs:times.length ? Math.round(Math.max(...times)) : null
  };
}

export function buildSessionSummary(snapshot = {}) {
  const stages = Array.isArray(snapshot.stages) ? snapshot.stages : [];
  const captured = new Set(stages
    .filter(value => value.role === 'sender' && value.stage === 'captured' && value.turnId)
    .map(value => value.turnId));
  return {
    sessionId:String(snapshot.sessionId || ''),
    questionsCaptured:captured.size,
    receiver:roleSummary(stages, 'receiver'),
    comparison:roleSummary(stages, 'comparison')
  };
}
