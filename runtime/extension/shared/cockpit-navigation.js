import { commandDefinition } from './operator-command-registry.js';

const VIEW_BY_CODE = Object.freeze({
  answer_no_response:['assist','choiceWorkspace'], receiver_draft_conflict:['assist','choiceWorkspace'],
  queue_only_active:['overview','deliveryPolicyBanner'], session_storage_critical:['review','memoryGuard'],
  inbox_oldest_stale:['queue','queueBody'], end_guard_blocked:['review','endSessionAction']
});
const VIEWS = new Set(['overview','queue','timeline','review','assist','production']);
const CHOICE_CODES = new Set(['answer_no_response','receiver_draft_conflict']);
function safeRoute(decision = {}) {
  const mapped = VIEW_BY_CODE[decision.code];
  const view = mapped?.[0] || (VIEWS.has(String(decision.view || '')) ? String(decision.view) : 'overview');
  const anchor = String(mapped?.[1] || decision.anchor || (view === 'assist' ? 'choiceWorkspace' : 'readinessGate')).slice(0, 100);
  return { view, anchor, reason:String(decision.code || 'operator_navigation').slice(0,120), internalOnly:true };
}
export function routeForDecision(decision = {}) { return safeRoute(decision); }
export function deriveContextualNavigation(snapshot = {}) {
  const decision=snapshot.production?.decisionCenter?.primary || snapshot.decisionCenter?.primary || null;
  const route=decision ? safeRoute(decision) : { view:'overview', anchor:'readinessGate', reason:'caught_up', internalOnly:true };
  const requestedMode=CHOICE_CODES.has(String(decision?.code || '')) ? 'choose' : decision?.actionMode || (decision?.command ? 'execute' : 'inspect');
  const executable=requestedMode==='execute' && Boolean(commandDefinition(decision?.command));
  const actionMode=requestedMode==='choose' ? 'choose' : executable ? 'execute' : 'inspect';
  return { route, actionMode, command:executable ? decision.command : '', payload:executable ? { ...(decision.payload || {}) } : {}, choices:actionMode==='choose' ? [...new Set(decision?.choices || [])] : [], title:decision?.title || 'No action required', detail:decision?.detail || 'The live system is caught up.' };
}
