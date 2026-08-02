export function deriveLiveActionDock(snapshot = {}) {
  const choice = snapshot.operatorChoice || null;
  const decision = snapshot.production?.decisionCenter?.primary || null;
  const counts = snapshot.ledgerCounts || {};
  const waiting = ['pending','persisted','failed','staged','submitting','inFlight'].reduce((sum,key)=>sum+Math.max(0,Number(counts[key] || 0)),0);
  const answer = String(snapshot.answerState?.state || snapshot.receiver?.answerState?.state || 'idle');
  const containment = snapshot.production?.containment || { state:snapshot.deliveryPolicy?.active ? 'queue_only' : 'normal' };
  const source = choice ? { title:choice.title, detail:choice.detail, mode:'choose', view:choice.view, anchor:choice.anchor } : decision ? { title:decision.title, detail:decision.detail, mode:decision.actionMode || (decision.command ? 'execute' : 'inspect'), command:decision.command || '', payload:decision.payload || {}, view:decision.view, anchor:decision.anchor } : null;
  return { answer, waiting, containment:String(containment.state || 'normal'), title:source?.title || (waiting ? `${waiting} protected question${waiting===1?'':'s'}` : 'Caught up'), detail:source?.detail || (waiting ? 'Every final remains in sequence-safe ownership.' : 'No operator action is required.'), action:source || { mode:'inspect', view:'overview', anchor:'readinessGate' }, ended:snapshot.mode === 'ended' };
}