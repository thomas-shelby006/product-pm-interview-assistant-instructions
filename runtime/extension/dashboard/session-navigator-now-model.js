import { deriveNextAction } from '../shared/next-action-model.js';

const WORKFLOW = Object.freeze(['prelaunch','launch','live','export','review','shutdown']);

function countUnresolved(snapshot = {}) {
  const counts = snapshot.ledgerCounts || {};
  if (Number.isFinite(Number(counts.unresolved))) return Math.max(0, Number(counts.unresolved));
  return (Array.isArray(snapshot.ledger) ? snapshot.ledger : []).filter(item => !['proven','archived'].includes(String(item.state))).length;
}

function workflowPhase(snapshot = {}) {
  const phase = String(snapshot.liveSession?.phase || 'setup');
  if (phase === 'ended' || snapshot.mode === 'ended') return 'shutdown';
  if (phase === 'debrief') return snapshot.postInterview?.reviewReady ? 'review' : 'export';
  if (['active','paused'].includes(phase)) return 'live';
  if (phase === 'ready') return 'launch';
  return 'prelaunch';
}

function deliveryState(snapshot = {}) {
  const unresolved = countUnresolved(snapshot);
  if (snapshot.deliveryPolicy?.active) return { state: 'contained', label: 'Queue only', detail: snapshot.deliveryPolicy.reason || 'Provider writes are blocked.', tone: 'warn' };
  if (snapshot.batchState?.active) return { state: 'active', label: 'Batch active', detail: `${snapshot.batchState.active.questionCount || snapshot.batchState.active.memberIds?.length || 0} protected question(s).`, tone: 'info' };
  if (unresolved) return { state: 'waiting', label: `${unresolved} waiting`, detail: 'Finals remain durable in the lossless ledger.', tone: 'warn' };
  return { state: 'clear', label: 'Caught up', detail: 'No unresolved final is waiting.', tone: 'ok' };
}

function answerState(snapshot = {}) {
  const answer = snapshot.answerState || {};
  const state = String(answer.state || answer.status || 'idle');
  const labels = { waiting:'Waiting', streaming:'Answering', complete:'Complete', no_response:'No response', timed_out:'Timed out', cancelled:'Cancelled', idle:'Idle' };
  return { state, label: labels[state] || state.replaceAll('_',' '), detail: answer.reason || answer.detail || 'Answer availability is tracked separately from delivery proof.', tone: ['no_response','timed_out','cancelled'].includes(state) ? 'warn' : state === 'complete' ? 'ok' : 'info' };
}

export function deriveNavigatorBreadcrumbs(snapshot = {}) {
  const current = workflowPhase(snapshot);
  const index = WORKFLOW.indexOf(current);
  return WORKFLOW.map((id, position) => ({
    id,
    label: id === 'prelaunch' ? 'Pre-launch' : id.charAt(0).toUpperCase() + id.slice(1),
    state: position < index ? 'complete' : position === index ? 'current' : 'upcoming',
    available: position <= index || (id === 'review' && snapshot.postInterview?.exportComplete)
  }));
}

export function deriveNavigatorPrimaryAction(snapshot = {}, now = Date.now()) {
  const phase = workflowPhase(snapshot);
  const decision = snapshot.production?.decisionCenter?.primaryAction || snapshot.decisionCenter?.primaryAction;
  if (decision?.command || decision?.view) return { ...decision, source: 'decision_center' };
  if (snapshot.deliveryPolicy?.active) return { id:'recheck_containment', label:'Recheck containment', command:'check_live', available:true, source:'delivery_policy' };
  if (snapshot.batchState?.pendingNoResponse) return { id:'choose_no_response', label:'Choose Wait, Retry or Continue', view:'queue', anchor:'receiverFlow', available:true, source:'receiver' };
  if (['unresolved','keep_manual'].includes(String(snapshot.batchState?.draftConflict?.state))) return { id:'resolve_draft', label:'Resolve manual draft conflict', view:'queue', anchor:'draftConflictCard', available:true, source:'receiver' };
  if (phase === 'prelaunch') return { id:'run_preflight', label:'Run guided preflight', command:'run_preflight', available:true, source:'workflow' };
  if (phase === 'launch') return { id:'start_mock', label:'Start mock interview', command:'start_mock', available:true, source:'workflow' };
  if (phase === 'export') return { id:'export_session', label:'Export session evidence', command:'export_session', available:true, source:'workflow' };
  if (phase === 'review') return { id:'open_review', label:'Open review workspace', view:'review', available:true, source:'workflow' };
  if (phase === 'shutdown') return { id:'prepare_end_session', label:'Review shutdown readiness', command:'prepare_end_session', available:true, source:'workflow' };
  const next = deriveNextAction(snapshot, now);
  return { id: next.command || next.view || 'monitor', label: next.label || next.title || 'Continue monitoring', command: next.command || '', view: next.view || '', anchor: next.anchor || '', available: next.available !== false, blockedReason: next.blockedReason || '', source:'next_action' };
}

export function deriveSessionNavigatorNow(snapshot = {}, local = {}, now = Date.now()) {
  const phase = workflowPhase(snapshot);
  const action = deriveNavigatorPrimaryAction(snapshot, now);
  return {
    phase,
    breadcrumbs: deriveNavigatorBreadcrumbs(snapshot),
    rail: [
      { id:'phase', label:'Phase', value: phase, detail:String(snapshot.liveSession?.phase || 'setup'), tone:'info' },
      { id:'delivery', label:'Delivery', value:deliveryState(snapshot).label, detail:deliveryState(snapshot).detail, tone:deliveryState(snapshot).tone },
      { id:'answer', label:'Answer', value:answerState(snapshot).label, detail:answerState(snapshot).detail, tone:answerState(snapshot).tone },
      { id:'runtime', label:'Runtime', value:snapshot.rootCause?.severity === 'error' ? 'Needs attention' : snapshot.mode || 'active', detail:snapshot.rootCause?.code || snapshot.consistencyAudit?.reason || 'No blocking runtime cause.', tone:snapshot.rootCause?.severity === 'error' ? 'error' : 'ok' }
    ],
    primaryAction: action,
    quickOpen: [
      { id:'now', label:'Open Now', tab:'now' }, { id:'search', label:'Search session', tab:'search' },
      { id:'threads', label:'Open question threads', tab:'threads' }, { id:'handoff', label:'Open handoff board', tab:'handoff' },
      { id:'debrief', label:'Open debrief', tab:'debrief' }
    ],
    selectedTab: String(local.activeTab || 'now')
  };
}

export { WORKFLOW as SESSION_WORKFLOW_PHASES };
