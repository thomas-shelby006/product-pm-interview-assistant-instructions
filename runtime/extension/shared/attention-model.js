const SEVERITY = Object.freeze({ critical: 4, error: 3, warn: 2, info: 1, none: 0 });

function candidate(target, reason, severity = 'info', action = '', evidence = {}) {
  return { target, reason, severity, action, evidence, rank: SEVERITY[severity] || 0 };
}

export function deriveAttentionTarget(snapshot = {}, now = Date.now()) {
  const values = [];
  const root = snapshot.rootCause || {};
  if (root.code && root.code !== 'healthy') values.push(candidate(root.owner || 'runtime', root.code, root.severity || 'error', root.nextAction || 'check_live', root.evidence));
  if (snapshot.deliveryPolicy?.active) values.push(candidate('delivery', snapshot.deliveryPolicy.reason || 'queue_only', 'error', 'check_live'));
  if (snapshot.batchState?.draftConflict && ['unresolved','keep_manual'].includes(snapshot.batchState.draftConflict.state)) values.push(candidate('receiver_draft', 'manual_draft_conflict', 'warn', 'resolve_draft_restore_pmia'));
  const unresolved = Number(snapshot.ledgerCounts?.persisted || 0) + Number(snapshot.ledgerCounts?.failed || 0);
  if (unresolved > 0) values.push(candidate('inbox', 'questions_waiting', unresolved > 5 ? 'warn' : 'info', 'resume_catch_up', { count: unresolved }));
  if (snapshot.answerState?.state === 'no_response') values.push(candidate('answer', 'no_response', 'warn', 'resolve_no_response'));
  if (snapshot.liveSession?.phase === 'setup') values.push(candidate('runbook', 'setup_incomplete', 'info', 'check_live'));
  values.sort((a, b) => b.rank - a.rank || String(a.target).localeCompare(String(b.target)));
  const primary = values[0] || candidate('none', 'caught_up', 'none', '');
  return { ...primary, secondary: values.slice(1, 4), evaluatedAt: Number(now) || Date.now() };
}
