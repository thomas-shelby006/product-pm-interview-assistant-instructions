export function formatDuration(value) {
  const ms = Math.max(0, Number(value) || 0);
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function roleHealth(role, now = Date.now()) {
  if (!role?.connected) return { label: 'Missing', tone: 'error', ageMs: null };
  const heartbeatAt = Number(role.heartbeatAt || 0);
  const ageMs = heartbeatAt ? Math.max(0, now - heartbeatAt) : null;
  if (role.phase === 'unresponsive') return { label: 'Unresponsive', tone: 'error', ageMs };
  if (ageMs !== null && ageMs > 15000) return { label: 'Stale', tone: 'error', ageMs };
  if (!role.composerReady) return { label: 'Composer waiting', tone: 'warn', ageMs };
  if (role.generating) return { label: 'Generating', tone: 'info', ageMs };
  return { label: 'Healthy', tone: 'ok', ageMs };
}

export function warningLabel(warning) {
  const labels = {
    sender_missing: 'Sender window is missing',
    receiver_missing: 'Receiver window is missing',
    sender_heartbeat_stale: 'Sender runtime heartbeat is stale',
    receiver_heartbeat_stale: 'Receiver runtime heartbeat is stale',
    sender_unresponsive: 'Sender runtime did not respond',
    receiver_unresponsive: 'Receiver runtime did not respond',
    sender_composer_missing: 'Sender composer is not ready',
    receiver_composer_missing: 'Receiver composer is not ready',
    queue_waiting: 'Final questions are waiting in the queue',
    transport_paused: 'Forwarding is paused'
  };
  return labels[warning?.code] || String(warning?.code || 'Runtime warning');
}

export function virtualSlice(items, scrollTop, viewportHeight, rowHeight = 52, overscan = 5) {
  const list = Array.isArray(items) ? items : [];
  const height = Math.max(rowHeight, Number(viewportHeight) || rowHeight);
  const start = Math.max(0, Math.floor(Math.max(0, scrollTop) / rowHeight) - overscan);
  const visibleCount = Math.ceil(height / rowHeight) + overscan * 2;
  const end = Math.min(list.length, start + visibleCount);
  return {
    start,
    end,
    offsetTop: start * rowHeight,
    totalHeight: list.length * rowHeight,
    items: list.slice(start, end)
  };
}

export function latestSessionContext(timeline) {
  const events = Array.isArray(timeline) ? timeline : [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const context = events[index]?.data?.sessionContext;
    if (context && typeof context === 'object') return { ...context };
  }
  return {};
}

export function buildDiagnostics(snapshot, now = Date.now()) {
  if (!snapshot) return { status: 'disconnected' };
  const role = value => ({
    connected: Boolean(value?.connected),
    provider: String(value?.provider || ''),
    phase: String(value?.phase || ''),
    composerReady: Boolean(value?.composerReady),
    generating: Boolean(value?.generating),
    heartbeatAgeMs: value?.heartbeatAt ? Math.max(0, now - value.heartbeatAt) : null
  });
  return {
    sessionId: snapshot.sessionId,
    mode: snapshot.mode,
    uptimeMs: snapshot.uptimeMs,
    sender: role(snapshot.sender),
    receiver: role(snapshot.receiver),
    queueCount: snapshot.queue?.length || 0,
    warningCodes: (snapshot.warnings || []).map(item => item.code),
    metrics: {
      delivered: snapshot.metrics?.delivered || 0,
      failed: snapshot.metrics?.failed || 0,
      deliverySuccessRate: snapshot.metrics?.deliverySuccessRate ?? 100,
      averageDeliveryProofMs: snapshot.metrics?.averageDeliveryProofMs || 0,
      answerTimeouts: snapshot.metrics?.answerTimeouts || 0
    },
    lastRepair: snapshot.lastRepair || null
  };
}

export function deriveReview(snapshot) {
  const context = latestSessionContext(snapshot?.timeline);
  const metrics = snapshot?.metrics || {};
  return {
    context,
    questions: metrics.finalsObserved || 0,
    delivered: metrics.delivered || 0,
    answerTimeouts: metrics.answerTimeouts || 0,
    deliverySuccessRate: metrics.deliverySuccessRate ?? 100,
    averageDeliveryProofMs: metrics.averageDeliveryProofMs || 0,
    averageAnswerElapsedMs: metrics.averageAnswerElapsedMs || 0
  };
}
