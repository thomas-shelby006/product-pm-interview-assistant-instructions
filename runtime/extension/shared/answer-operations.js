import { stableFingerprint } from './batch-planner.js';

export function buildAnswerAcknowledgement(value = {}, now = Date.now()) {
  const batchId = String(value.batchId || '');
  const state = String(value.answerState?.state || value.state || 'unknown');
  return {
    batchId,
    state,
    acknowledged: Boolean(value.acknowledged),
    acknowledgedAt: Math.max(0, Number(value.acknowledgedAt || 0)),
    completedAt: Math.max(0, Number(value.completedAt || now)),
    memberIds: Array.isArray(value.memberIds) ? value.memberIds.map(String) : [],
    reason: String(value.reason || value.answerState?.reason || '')
  };
}

export function acknowledgeAnswer(value = {}, now = Date.now()) {
  const current = buildAnswerAcknowledgement(value, now);
  return { ...current, acknowledged: true, acknowledgedAt: now };
}

export function resolveNoResponse(value = {}, action = 'wait', now = Date.now()) {
  const allowed = new Set(['wait', 'retry', 'continue']);
  const selected = allowed.has(String(action)) ? String(action) : 'wait';
  return {
    ok: true,
    action: selected,
    batchId: String(value.batchId || ''),
    memberIds: Array.isArray(value.memberIds) ? value.memberIds.map(String) : [],
    resolvedAt: now,
    nextAction: selected === 'retry' ? 'retry_completed_batch' : selected === 'continue' ? 'submit_next' : 'extend_wait'
  };
}

export function deriveAnswerDeadlineView(answerState = {}, now = Date.now()) {
  const deadlineAt = Math.max(0, Number(answerState.deadlineAt || 0));
  const state = String(answerState.state || 'idle');
  const terminal = ['complete', 'no_response', 'timed_out', 'cancelled'].includes(state);
  return {
    state,
    terminal,
    deadlineAt,
    remainingMs: deadlineAt && !terminal ? Math.max(0, deadlineAt - now) : 0,
    overdue: Boolean(deadlineAt && !terminal && now >= deadlineAt),
    reason: String(answerState.reason || '')
  };
}

export function buildInterruptPlan(snapshot = {}, now = Date.now()) {
  const activeIds = Array.isArray(snapshot.active?.prompt?.memberIds) ? snapshot.active.prompt.memberIds.map(String) : [];
  const nextEntries = Array.isArray(snapshot.next?.entries) ? snapshot.next.entries : [];
  const latest = nextEntries.at(-1);
  const preservedIds = nextEntries.slice(0, -1).map(item => String(item.id || ''));
  const latestId = String(latest?.id || latest?.envelope?.id || '');
  const token = stableFingerprint([activeIds.join('|'), preservedIds.join('|'), latestId, snapshot.active?.id || '', now].join('::'));
  return {
    ok: Boolean(latestId),
    token,
    createdAt: now,
    activeBatchId: String(snapshot.active?.id || ''),
    activeMemberIds: activeIds,
    latestId,
    latestSeq: Math.max(0, Number(latest?.envelope?.seq || 0)),
    preservedIds,
    action: 'stop_current_and_submit_latest'
  };
}

export function buildAnswerHandoff(value = {}) {
  const answer = buildAnswerAcknowledgement(value, value.completedAt || Date.now());
  return {
    batchId: answer.batchId,
    memberCount: answer.memberIds.length,
    state: answer.state,
    reason: answer.reason,
    completedAt: answer.completedAt,
    elapsedMs: Math.max(0, Number(value.answerState?.elapsedMs || value.elapsedMs || 0)),
    wordCount: Math.max(0, Number(value.answerState?.wordCount || value.wordCount || 0)),
    proofVerified: value.proof?.verified === true,
    acknowledged: answer.acknowledged
  };
}
