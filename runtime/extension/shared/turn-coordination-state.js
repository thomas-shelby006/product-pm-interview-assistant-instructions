import {
  composeBatchPrompt,
  memberSetFingerprint,
  stableFingerprint
} from './batch-planner.js';

const MODES = new Set(['live', 'paused_accumulating', 'resume_pending', 'submitting']);

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

function asPlannerEntry(value, index = 0) {
  if (value?.envelope) return value;
  const envelope = value && typeof value === 'object' ? value : {};
  return {
    id: String(envelope.id || `segment-${index + 1}`),
    envelope,
    addedAt: Math.max(0, Number(envelope.createdAt || index + 1))
  };
}

export function normalizeTurnCoordination(value = {}, now = Date.now()) {
  const source = value && typeof value === 'object' ? value : {};
  const interruption = source.interruption && typeof source.interruption === 'object'
    ? source.interruption
    : {};
  return {
    version: 1,
    policy: ['adaptive', 'conservative', 'manual'].includes(String(source.policy)) ? String(source.policy) : 'adaptive',
    mode: MODES.has(String(source.mode)) ? String(source.mode) : 'live',
    pausedAt: Math.max(0, Number(source.pausedAt || 0)),
    resumedAt: Math.max(0, Number(source.resumedAt || 0)),
    releaseIntent: ['send', 'hold'].includes(String(source.releaseIntent)) ? String(source.releaseIntent) : '',
    updatedAt: Math.max(0, Number(source.updatedAt || now)),
    interruption: {
      state: String(interruption.state || 'none'),
      chainId: String(interruption.chainId || ''),
      memberIds: uniqueIds(interruption.memberIds),
      activeBatchId: String(interruption.activeBatchId || ''),
      continuationId: String(interruption.continuationId || ''),
      startedAt: Math.max(0, Number(interruption.startedAt || 0)),
      lastAttemptAt: Math.max(0, Number(interruption.lastAttemptAt || 0)),
      attempts: Math.max(0, Number(interruption.attempts || 0)),
      reason: String(interruption.reason || ''),
      failureReason: String(interruption.failureReason || '')
    }
  };
}
export function transitionTurnCoordination(current = {}, event = {}) {
  const state = normalizeTurnCoordination(current, event.at);
  const at = Math.max(0, Number(event.at || Date.now()));
  const type = String(event.type || '');
  if (type === 'pause') {
    if (state.mode === 'paused_accumulating') return state;
    return { ...state, mode: 'paused_accumulating', pausedAt: at, releaseIntent: '', updatedAt: at };
  }
  if (type === 'resume_send') {
    return { ...state, mode: 'resume_pending', resumedAt: at, releaseIntent: 'send', updatedAt: at };
  }
  if (type === 'resume_hold') {
    return { ...state, mode: 'live', resumedAt: at, releaseIntent: 'hold', updatedAt: at };
  }
  if (type === 'release_started') {
    return { ...state, mode: 'submitting', releaseIntent: 'send', updatedAt: at };
  }
  if (type === 'release_finished') {
    return { ...state, mode: 'live', releaseIntent: '', updatedAt: at };
  }
  if (type === 'interrupt_detected') {
    return {
      ...state,
      updatedAt: at,
      interruption: {
        state: 'stop_pending',
        chainId: String(event.chainId || `chain-${at}`),
        memberIds: uniqueIds(event.memberIds),
        activeBatchId: String(event.activeBatchId || ''),
        continuationId: String(event.continuationId || ''),
        startedAt: at,
        reason: String(event.reason || 'source_answer_interrupted')
      }
    };
  }
  if (type === 'interrupt_failed') {
    return {
      ...state,
      updatedAt: at,
      interruption: {
        ...state.interruption,
        state: 'recovery_required',
        chainId: String(event.chainId || state.interruption.chainId || `chain-${at}`),
        memberIds: uniqueIds(event.memberIds || state.interruption.memberIds),
        activeBatchId: String(event.activeBatchId || state.interruption.activeBatchId || ''),
        continuationId: String(event.continuationId || state.interruption.continuationId || ''),
        startedAt: state.interruption.startedAt || at,
        lastAttemptAt: at,
        attempts: Math.max(1, Number(state.interruption.attempts || 0) + 1),
        reason: String(event.reason || state.interruption.reason || 'source_answer_interrupted'),
        failureReason: String(event.failureReason || 'carryover_failed')
      }
    };
  }
  if (type === 'interrupt_resolved') {
    return {
      ...state,
      updatedAt: at,
      interruption: { ...state.interruption, state: 'resolved', failureReason: '', lastAttemptAt: at }
    };
  }
  return state;
}

export function composeTurnCoordinatedPrompt({ entries = [] } = {}, state = {}) {
  const normalizedEntries = (Array.isArray(entries) ? entries : []).map(asPlannerEntry);
  const base = composeBatchPrompt({ entries: normalizedEntries });
  const coordination = normalizeTurnCoordination(state);
  const carried = coordination.interruption?.state && coordination.interruption.state !== 'none';
  if (!base.questionCount || (coordination.mode === 'live' && !carried)) return base;
  const latest = normalizedEntries.at(-1)?.envelope;
  const earlier = normalizedEntries.slice(0, -1);
  const opening = carried
    ? 'The previous answer was interrupted and should be treated as not delivered.'
    : 'Forwarding was paused.';
  const text = [
    opening,
    'Use every question segment below as one combined context. Preserve relevant earlier context, focus primarily on the latest question, and answer the combined request.',
    'Do not assume the previous answer reached the user.',
    '',
    ...earlier.flatMap((entry, index) => [`QUESTION SEGMENT ${index + 1}:`, String(entry.envelope?.text || '').trim(), '']),
    'LATEST ACTIONABLE QUESTION (HIGHEST PRIORITY):',
    String(latest?.text || '').trim()
  ].join('\n');
  return {
    ...base,
    text,
    fingerprint: stableFingerprint(`${base.memberIds.join('|')}::${text}`),
    memberFingerprint: memberSetFingerprint(base.memberIds),
    coordinationMode: carried ? 'carryover' : 'paused'
  };
}
export function composePausedDraftPrompt({ entries = [], totalCount = 0, partitionCount = 1 } = {}, state = {}) {
  const normalizedEntries = (Array.isArray(entries) ? entries : []).map(asPlannerEntry);
  const finalPrompt = composeTurnCoordinatedPrompt({ entries: normalizedEntries }, { ...state, mode:'paused_accumulating' });
  const protectedCount = Math.max(normalizedEntries.length, Number(totalCount || 0));
  const partitions = Math.max(1, Number(partitionCount || 1));
  const text = [
    'FORWARDING PAUSED — NOT SUBMITTED',
    `${protectedCount} protected segment${protectedCount === 1 ? '' : 's'}${partitions > 1 ? ` across ${partitions} ordered partitions` : ''}.`,
    'Resume and send will replace this banner with the final combined-turn instruction before submission.',
    'Resume without sending will keep this protected draft in Window 2.',
    '',
    finalPrompt.text
  ].join('\n');
  return {
    ...finalPrompt,
    text,
    fingerprint: stableFingerprint(`paused-presentation::${finalPrompt.fingerprint}::${protectedCount}::${partitions}`),
    finalFingerprint: finalPrompt.fingerprint,
    presentationOnly: true,
    protectedCount,
    partitionCount: partitions
  };
}

export function deriveTurnResumePreview(value = {}, plannerState = {}) {
  const state = normalizeTurnCoordination(value);
  const next = plannerState?.next && typeof plannerState.next === 'object' ? plannerState.next : {};
  const memberIds = Array.isArray(next.entries)
    ? next.entries.map(entry => String(entry?.id || '')).filter(Boolean)
    : Array.isArray(next.memberIds) ? next.memberIds.map(String).filter(Boolean) : [];
  const partitions = Array.isArray(next.partitions) ? next.partitions : [];
  const firstPartitionIds = partitions[0]?.memberIds?.map(String).filter(Boolean)
    || next.prompt?.memberIds?.map(String).filter(Boolean)
    || [];
  const partitionCount = Math.max(0, Number(next.partitionCount || partitions.length || (memberIds.length ? 1 : 0)));
  const submit = state.releaseIntent !== 'hold';
  return {
    mode: state.mode,
    policy: state.policy,
    heldCount: memberIds.length,
    memberIds,
    partitionCount,
    firstPartitionIds,
    remainingCount: Math.max(0, Number(next.remainingCount || memberIds.length - firstPartitionIds.length)),
    onResume: submit ? (partitionCount > 1 ? 'submit_first_partition' : 'submit_combined_draft') : 'retain_protected_draft',
    releaseIntent: submit ? 'send' : 'hold',
    actionable: memberIds.length > 0 && ['paused_accumulating','resume_pending'].includes(state.mode)
  };
}

export function deriveTurnCoordinationSnapshot(value = {}, plannerState = {}) {
  const state = normalizeTurnCoordination(value);
  const entries = Array.isArray(plannerState?.next?.entries) ? plannerState.next.entries : [];
  const activeEntries = Array.isArray(plannerState?.active?.entries) ? plannerState.active.entries : [];
  const heldMemberIds = entries.map(entry => String(entry?.id || '')).filter(Boolean);
  const heldTimes = entries.map(entry => Number(entry?.addedAt || 0)).filter(time => time > 0);
  return {
    ...state,
    heldCount: heldMemberIds.length,
    heldMemberIds,
    activeMemberIds: activeEntries.map(entry => String(entry?.id || '')).filter(Boolean),
    oldestHeldAt: heldTimes.length ? Math.min(...heldTimes) : 0,
    actionable: state.mode === 'paused_accumulating' || state.mode === 'resume_pending'
      || (state.interruption?.state && !['none', 'resolved'].includes(state.interruption.state))
  };
}

export function correlateSourceInterruption({
  activeBatchMemberIds = [],
  sourceSegmentIds = [],
  sourceOutcome = '',
  continuationId = '',
  now = Date.now()
} = {}) {
  const active = uniqueIds(activeBatchMemberIds);
  const source = uniqueIds(sourceSegmentIds);
  const continuation = String(continuationId || '');
  const exactActiveCoverage = source.length > 0 && source.every(id => active.includes(id));
  if (sourceOutcome !== 'interrupted') {
    return { correlated: false, state: 'none', reason: 'source_completed', memberIds: [] };
  }
  if (!exactActiveCoverage) {
    return { correlated: false, state: 'none', reason: 'active_batch_mismatch', memberIds: [] };
  }
  if (!continuation) {
    return { correlated: false, state: 'none', reason: 'continuation_missing', memberIds: [] };
  }
  const memberIds = uniqueIds([...source, continuation]);
  return {
    correlated: true,
    state: 'stop_pending',
    reason: 'source_answer_interrupted',
    chainId: `chain-${Math.max(0, Number(now || Date.now()))}-${memberSetFingerprint(memberIds)}`,
    memberIds,
    activeBatchId: '',
    continuationId: continuation,
    startedAt: Math.max(0, Number(now || Date.now()))
  };
}
