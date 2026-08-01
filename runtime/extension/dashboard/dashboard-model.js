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
  if (role.phase === 'boot') return { label: 'Starting', tone: 'warn', ageMs };
  if (role.phase === 'registered') return { label: 'Registering', tone: 'warn', ageMs };
  if (role.phase && role.phase !== 'ready') return { label: 'Not ready', tone: 'warn', ageMs };
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
    sender_lifecycle_not_ready: 'Sender runtime has not reached READY',
    receiver_lifecycle_not_ready: 'Receiver runtime has not reached READY',
    queue_waiting: 'Final questions are waiting in the queue',
    queue_oldest_stale: 'The oldest actionable queued question has waited over two minutes',
    sender_voice_transcript_slow: 'Voice is active but transcript updates are delayed',
    sender_voice_transcript_stalled: 'Voice is active but transcript updates appear stalled',
    sender_source_silent: 'No actionable sender transcript has been observed for 90 seconds',
    receiver_proof_unverified: 'Receiver submission was not verified by a rendered provider turn',
    receiver_proof_failed: 'Receiver delivery did not produce provider-rendered proof',
    repair_in_progress: 'Runtime repair is waiting for both roles to report healthy',
    runtime_degraded: 'Runtime repair could not restore full health',
    sender_adapter_incomplete: 'Sender provider adapter is missing required capabilities',
    receiver_adapter_incomplete: 'Receiver provider adapter is missing required capabilities',
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


export function actionableQueue(items, includeSuperseded = false) {
  const queue = Array.isArray(items) ? items : [];
  return includeSuperseded
    ? queue
    : queue.filter(item => item?.status !== 'superseded');
}

export function primaryTransportAction(mode) {
  return mode === 'paused'
    ? { command: 'resume_without_send', label: 'Resume forwarding' }
    : { command: 'pause', label: 'Pause forwarding' };
}


export function latestReceiverProof(timeline) {
  const events = Array.isArray(timeline) ? timeline : [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === 'receiver_proof') return { ...events[index] };
  }
  return null;
}

export function commandResultLabel(command, result = {}) {
  const labels = {
    pause: 'Forwarding paused',
    resume_without_send: 'Forwarding resumed',
    resume_latest: result.reason === 'queue_empty'
      ? 'Forwarding resumed; queue empty'
      : 'Forwarding resumed; latest final handled',
    send_selected: result.delivered ? 'Selected final delivered' : 'Selected final remains queued',
    discard_selected: 'Selected final discarded',
    discard_superseded: `${Math.max(0, Number(result.discarded) || 0)} superseded final(s) cleared`,
    discard_all: `${Math.max(0, Number(result.discarded) || 0)} queued final(s) discarded`,
    check_live: result.ok ? 'Live check passed' : 'Live check found issues',
    repair_runtime: result.pendingVerification
      ? 'Repair started; verifying both roles'
      : result.ok ? 'Runtime repair verified' : 'Runtime repair incomplete',
    resend_context: 'Context resend scheduled',
    toggle_mic: 'Sender microphone toggled',
    toggle_scroll: 'Receiver scroll lock toggled',
    focus_composer: 'Receiver composer focused',
    export_session: 'Session export started',
    layout_both: 'Three-window layout applied',
    layout_sender: 'Sender layout applied',
    layout_receiver: 'Receiver layout applied',
    layout_dashboard: 'Dashboard layout applied',
    hide_managed: 'Managed windows hidden',
    restore_managed: 'Managed windows restored',
    end_session: 'Session ended'
  };
  return labels[command] || String(command || 'Command').replaceAll('_', ' ');
}
