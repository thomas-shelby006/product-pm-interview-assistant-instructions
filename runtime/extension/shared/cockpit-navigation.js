const VIEW_BY_CODE = Object.freeze({ answer_no_response: ['queue','receiverPolicyState'], receiver_draft_conflict: ['queue','draftConflictState'], queue_only_active: ['overview','deliveryPolicyBanner'], session_storage_critical: ['review','memoryGuard'], inbox_oldest_stale: ['queue','queueBody'], end_guard_blocked: ['review','endSessionAction'] });
export function routeForDecision(decision = {}) {
  const [view, anchor] = VIEW_BY_CODE[decision.code] || [decision.view || 'overview', decision.anchor || 'readinessGate'];
  return { view, anchor, reason: decision.code || 'operator_navigation', internalOnly: true };
}
export function deriveContextualNavigation(snapshot = {}) {
  const decision = snapshot.production?.decisionCenter?.primary || snapshot.decisionCenter?.primary || null;
  const route = decision ? routeForDecision(decision) : { view: 'overview', anchor: 'readinessGate', reason: 'caught_up', internalOnly: true };
  return { route, command: decision?.command || '', payload: decision?.payload || {}, title: decision?.title || 'No action required', detail: decision?.detail || 'The live system is caught up.' };
}
