function ids(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

function action(command, label, kind = 'secondary') {
  return { command, label, kind };
}

function countMembers(value = {}) {
  const memberIds = ids(value?.memberIds || value?.prompt?.memberIds);
  return Math.max(memberIds.length, Math.max(0, Number(value?.questionCount || 0)));
}

function normalizeLatency(snapshot = {}) {
  const value = snapshot?.turnPerformance || snapshot?.metrics?.turnCoordinationSummary || snapshot?.metrics?.turnCoordination || {};
  const throughput = value.throughput && typeof value.throughput === 'object' ? value.throughput : {};
  return {
    state: String(value.state || 'insufficient'),
    p50Ms: Math.max(0, Number(value.p50Ms || 0)),
    p95Ms: Math.max(0, Number(value.p95Ms || 0)),
    maxMs: Math.max(0, Number(value.maxMs || 0)),
    sampleCount: Math.max(0, Number(value.sampleCount || 0)),
    staleCount: Math.max(0, Number(value.staleCount || 0)),
    dominantStage: String(value.dominantStage || ''),
    stages: value.stages && typeof value.stages === 'object' ? { ...value.stages } : {},
    throughput: {
      admittedLastMinute: Math.max(0, Number(throughput.admittedLastMinute || 0)),
      turnsPerMinute: Math.max(0, Number(throughput.turnsPerMinute || 0)),
      targetPerMinute: Math.max(1, Number(throughput.targetPerMinute || 20)),
      targetMet: throughput.targetMet === true
    }
  };
}

export function deriveTurnCoordinationCockpit(snapshot = {}, now = Date.now()) {
  const batch = snapshot?.batchState || {};
  const coordination = batch.turnCoordination || {};
  const interruption = coordination.interruption || {};
  const conflict = batch.draftConflict;
  const heldIds = ids(coordination.heldMemberIds || batch.next?.memberIds);
  const heldCount = Math.max(
    heldIds.length,
    Math.max(0, Number(coordination.heldCount || 0)),
    countMembers(batch.next)
  );
  const activeIds = ids(batch.active?.memberIds || batch.active?.prompt?.memberIds);
  const activeCount = Math.max(activeIds.length, countMembers(batch.active));
  const chainIds = ids(interruption.memberIds);
  const carryoverCount = Math.max(chainIds.length, ['none', 'resolved'].includes(String(interruption.state || 'none')) ? 0 : 1);
  const policy = ['adaptive', 'conservative', 'manual'].includes(String(coordination.policy))
    ? String(coordination.policy)
    : 'adaptive';
  const mode = String(coordination.mode || 'live');
  const interruptionState = String(interruption.state || 'none');
  const ageMs = coordination.oldestHeldAt
    ? Math.max(0, Number(now) - Number(coordination.oldestHeldAt))
    : coordination.pausedAt
      ? Math.max(0, Number(now) - Number(coordination.pausedAt))
      : 0;

  let state = 'live';
  if (conflict && ['unresolved', 'keep_manual'].includes(String(conflict.state))) state = 'blocked';
  else if (['detected', 'stop_pending', 'stop_requested', 'carryover_pending', 'recovery_required'].includes(interruptionState)) state = 'carryover';
  else if (['paused_accumulating', 'resume_pending', 'submitting'].includes(mode)) state = 'paused';
  else if (interruptionState === 'resolved' && String(interruption.chainId || '')) state = 'recovered';

  const actions = state === 'paused'
    ? [
        action('resume_catch_up', 'Resume and send', 'primary'),
        action('resume_without_send', 'Resume without sending')
      ]
    : state === 'carryover'
      ? [action('check_live', 'Check carryover health', 'primary')]
      : state === 'blocked'
        ? [
            action('resolve_draft_restore_pmia', 'Restore PMIA draft', 'primary'),
            action('resolve_draft_merge', 'Merge drafts')
          ]
        : [action('pause', 'Pause forwarding', 'primary')];
  const primary = actions.find(item => item.kind === 'primary') || actions[0] || null;
  const secondary = actions.find(item => item !== primary) || null;
  const labels = {
    live: ['Forwarding live', 'New finalized turns submit when Window 2 is ready.'],
    paused: ['Paused and accumulating', `${heldCount} protected segment${heldCount === 1 ? '' : 's'} remain in one ordered draft.`],
    carryover: ['Carryover needs attention', `${carryoverCount || 1} segment${carryoverCount === 1 ? '' : 's'} remain bound to ${interruption.chainId || 'the interrupted answer'}.`],
    blocked: ['Manual draft conflict', 'Automatic provider writes remain blocked until the composer conflict is resolved.'],
    recovered: ['Carryover recovered', 'The interrupted chain was resolved without losing member identity.']
  };
  const latency = normalizeLatency(snapshot);
  return {
    state,
    label: labels[state][0],
    title: labels[state][0],
    detail: labels[state][1],
    tone: state === 'blocked' || state === 'carryover' ? 'warn' : state === 'recovered' ? 'ok' : 'neutral',
    policy,
    mode,
    activeCount,
    heldCount,
    carryoverCount,
    autoSend: batch.autoSubmit !== false,
    latency,
    held: { count: heldCount, memberIds: heldIds, ageMs },
    chain: {
      state: interruptionState,
      id: String(interruption.chainId || ''),
      count: carryoverCount,
      memberIds: chainIds,
      reason: String(interruption.reason || ''),
      activeBatchId: String(interruption.activeBatchId || '')
    },
    preview: {
      count: heldCount,
      memberIds: heldIds,
      partitionCount: Math.max(0, Number(batch.next?.partitionCount || (heldCount ? 1 : 0))),
      firstPartitionIds: ids(batch.next?.partitions?.[0]?.memberIds || batch.next?.prompt?.memberIds || heldIds),
      remainingCount: Math.max(0, Number(batch.next?.remainingCount || 0)),
      focusId: String(batch.next?.focusId || coordination.heldMemberIds?.at?.(-1) || heldIds.at(-1) || ''),
      releaseIntent: String(coordination.releaseIntent || ''),
      onResume: heldCount
        ? Math.max(0, Number(batch.next?.partitionCount || 1)) > 1 ? 'submit_first_partition' : 'submit_combined_draft'
        : 'nothing_to_submit'
    },
    primary,
    secondary,
    actions
  };
}
