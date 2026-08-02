import { deriveOperatorChoice } from '../shared/operator-choice-model.js';
function protectedCount(counts = {}) {
  if (Number.isFinite(Number(counts.unresolved))) return Math.max(0, Number(counts.unresolved));
  return Math.max(0, Number(counts.pending || 0)) + Math.max(0, Number(counts.inFlight || 0));
}
export function deriveLiveActionDock(snapshot = {}) {
  const choice = snapshot.operatorChoice || deriveOperatorChoice(snapshot);
  const decision = snapshot.production?.decisionCenter?.primary || null;
  const waiting = protectedCount(snapshot.ledgerCounts || {});
  const answer = String(snapshot.answerState?.state || snapshot.receiver?.answerState?.state || 'idle');
  const containment = snapshot.production?.containment || { state:snapshot.deliveryPolicy?.active ? 'queue_only' : 'normal' };
  const connected = snapshot.dashboardConnections !== 0 && snapshot.mode !== 'ended';
  const source = choice ? { title:choice.title, detail:choice.detail, mode:'choose', view:'assist', anchor:'choiceWorkspace' } : decision ? { title:decision.title, detail:decision.detail, mode:decision.actionMode || (decision.command ? 'execute' : 'inspect'), command:decision.command || '', payload:{ ...(decision.payload || {}) }, view:decision.view, anchor:decision.anchor } : null;
  const action = !connected ? { mode:'inspect', view:'overview', anchor:'connectionState' } : source || { mode:'inspect', view:'overview', anchor:'readinessGate' };
  return { answer, waiting, containment:String(containment.state || 'normal'), title:source?.title || (waiting ? `${waiting} protected question${waiting===1?'':'s'}` : 'Caught up'), detail:source?.detail || (waiting ? 'Every final remains in sequence-safe ownership.' : 'No operator action is required.'), action, ended:snapshot.mode === 'ended', connected };
}
