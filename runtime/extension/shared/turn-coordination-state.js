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
      reason: String(interruption.reason || '')
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
  if (type === 'interrupt_resolved') {
    return {
      ...state,
      updatedAt: at,
      interruption: { ...state.interruption, state: 'resolved' }
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
  const reason = carried ? 'the previous answer was interrupted and should be treated as not delivered' : 'forwarding was paused';
  const text = [
    `Forwarding was paused or ${reason}.`,
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
