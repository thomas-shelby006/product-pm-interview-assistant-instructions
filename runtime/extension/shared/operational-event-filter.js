const GROUPS = Object.freeze({
  delivery: /final|batch|proof|ledger|sequence|outbox|delivery/,
  answer: /answer|generation/,
  recovery: /repair|recover|self_test|live_check|consistency|compatibility/,
  operator: /command|marker|phase|focus|layout|archive|pause|resume/,
  system: /heartbeat|registration|storage|alarm|worker|lifecycle/
});

export function classifyOperationalEvent(event = {}) {
  const type = String(event.type || '').toLowerCase();
  const group = Object.entries(GROUPS).find(([, pattern]) => pattern.test(type))?.[0] || 'system';
  const severity = /failed|error|blocked|timeout|critical/.test(type) ? 'error' : /warn|degraded|stale|gap/.test(type) ? 'warn' : 'info';
  return { ...event, group, severity };
}

export function filterOperationalEvents(events = [], { group = 'all', severity = 'all', query = '', limit = 200 } = {}) {
  const term = String(query || '').trim().toLowerCase();
  return (Array.isArray(events) ? events : []).map(classifyOperationalEvent).filter(item => {
    if (group !== 'all' && item.group !== group) return false;
    if (severity !== 'all' && item.severity !== severity) return false;
    if (!term) return true;
    return `${item.type} ${item.data?.reason || ''} ${item.data?.envelopeId || ''} ${item.data?.batchId || ''}`.toLowerCase().includes(term);
  }).slice(-Math.max(1, Number(limit) || 200));
}
