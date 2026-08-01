function blocker(code, label, action = 'check_live') {
  return { code, label, action };
}

function latestEvent(snapshot, types) {
  const wanted = new Set(types);
  const timeline = Array.isArray(snapshot?.timeline) ? snapshot.timeline : [];
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    if (wanted.has(timeline[index]?.type)) return timeline[index];
  }
  return null;
}

export function deriveReadiness(snapshot, now = Date.now()) {
  if (!snapshot) {
    return { state: 'not_ready', label: 'Not ready', blockers: [blocker('snapshot_missing', 'Waiting for Runtime Pilot state')], actions: ['check_live'] };
  }
  if (snapshot.mode === 'repairing') {
    return { state: 'repairing', label: 'Repairing', blockers: [blocker('repair_in_progress', 'Runtime repair has not been verified', 'repair_runtime')], actions: ['check_live'] };
  }
  const blockers = [];
  if (snapshot.mode === 'blocked') blockers.push(blocker('runtime_blocked', 'Runtime recovery is blocked', 'repair_runtime'));
  if (Number(snapshot.dashboardConnections || 0) < 1) blockers.push(blocker('dashboard_disconnected', 'Runtime Pilot is not connected'));
  for (const role of ['sender', 'receiver']) {
    const value = snapshot[role] || {};
    if (!value.connected) blockers.push(blocker(`${role}_missing`, `${role === 'sender' ? 'Window 1' : 'Window 2'} runtime is missing`, 'repair_runtime'));
    else {
      if (value.phase !== 'ready') blockers.push(blocker(`${role}_not_ready`, `${role === 'sender' ? 'Window 1' : 'Window 2'} has not reached READY`, 'repair_runtime'));
      if (!value.composerReady) blockers.push(blocker(`${role}_composer`, `${role === 'sender' ? 'Window 1' : 'Window 2'} composer is unavailable`, 'repair_runtime'));
      if (value.adapterCapabilities?.complete !== true) blockers.push(blocker(`${role}_adapter`, `${role === 'sender' ? 'Window 1' : 'Window 2'} adapter capability check is incomplete`, 'repair_runtime'));
      const heartbeatAge = value.heartbeatAt ? Math.max(0, Number(now) - Number(value.heartbeatAt)) : Infinity;
      if (heartbeatAge > 15000) blockers.push(blocker(`${role}_heartbeat`, `${role === 'sender' ? 'Window 1' : 'Window 2'} heartbeat is stale`, 'repair_runtime'));
    }
  }
  if (!snapshot.contextArmed) blockers.push(blocker('context_unarmed', 'Session context has not been armed', 'check_live'));
  if (snapshot.storagePressure?.level === 'critical') blockers.push(blocker('storage_critical', 'Session memory is critically high', 'compact_proven'));
  if (snapshot.mode === 'degraded') blockers.push(blocker('runtime_degraded', 'Runtime is degraded', 'repair_runtime'));

  const gapEvent = latestEvent(snapshot, ['sequence_gap', 'sequence_gap_cleared']);
  if (gapEvent?.type === 'sequence_gap') blockers.push(blocker('sequence_gap', `Waiting for sequence ${gapEvent.data?.expectedSeq || '?'}`, 'check_live'));
  const outboxEvent = latestEvent(snapshot, ['outbox_state']);
  if (Number(outboxEvent?.data?.count || 0) > 0) blockers.push(blocker('outbox_retained', `${outboxEvent.data.count} Window 1 final(s) await persistence`, 'retry_outbox'));

  const actions = [...new Set(blockers.map(item => item.action).filter(Boolean))];
  return blockers.length
    ? { state: 'not_ready', label: 'Not ready', blockers, actions }
    : { state: 'ready', label: 'Ready', blockers: [], actions: [] };
}
