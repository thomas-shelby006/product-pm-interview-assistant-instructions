import { COMMAND_REGISTRY } from '../shared/operator-command-registry.js';
import { buildCompactionPlan } from '../shared/storage-accounting.js';
import { deriveProviderRouteTransition } from '../shared/provider-route-transition.js';

const n = value => Math.max(0, Number(value) || 0);
const text = value => String(value || '');
const unresolved = snapshot => n(snapshot.ledgerCounts?.unresolved ?? (n(snapshot.ledgerCounts?.pending) + n(snapshot.ledgerCounts?.inFlight)));
const item = (id, label, state, detail, tone = 'neutral') => ({ id, label, state, detail, tone });

export function deriveCommandHealth(snapshot = {}) {
  const audit = snapshot.commandReachability || snapshot.production?.commandReachability || {};
  const errors = Array.isArray(audit.errors) ? audit.errors : [];
  return item('command_health','Command health',errors.length ? 'attention' : 'healthy',errors.length ? `${errors.length} command route issue${errors.length===1?'':'s'}.` : `${audit.registeredCount || COMMAND_REGISTRY.length} commands have registry ownership.`,errors.length?'warn':'good');
}

export function deriveReplayGuard(snapshot = {}) {
  const journal = snapshot.commandJournal || [];
  const pending = n(snapshot.dashboardOperations?.pending || snapshot.operationActivity?.pending);
  const replayed = journal.reduce((sum,entry)=>sum+n(entry.replayCount),0);
  const failed = journal.filter(entry=>entry.result?.ok===false).length;
  return item('replay_guard','Replay guard',pending ? 'pending' : failed ? 'review' : 'clear',`${pending} pending · ${replayed} replayed · ${failed} failed.`,pending||failed?'warn':'good');
}

export function deriveRouteTransition(snapshot = {}) {
  const result = deriveProviderRouteTransition({ previous:snapshot.previousRoute || snapshot.routeHistory?.at?.(-2), current:snapshot.production?.routeReadiness || snapshot.routeReadiness, activeCount:n(snapshot.batchState?.active?.questionCount), nextCount:n(snapshot.batchState?.next?.questionCount) });
  return item('route_transition','Route transition',result.freezeWrites ? 'protected' : 'stable',result.explanation || (result.freezeWrites ? 'Provider writes remain frozen while the route is revalidated.' : 'The current provider route is stable.'),result.freezeWrites?'warn':'good');
}

export function deriveSessionSafety(snapshot = {}) {
  const choice = snapshot.operatorChoice ? 1 : 0;
  const outbox = n(snapshot.senderOutboxState?.count);
  const live = ['active','paused'].includes(text(snapshot.liveSession?.phase)) ? 1 : 0;
  const total = unresolved(snapshot) + choice + outbox + live;
  return item('session_safety','Session safety',total ? 'blocked' : 'clear',`${unresolved(snapshot)} unresolved · ${outbox} outbox · ${choice} choice · ${live} live phase.`,total?'warn':'good');
}

export function deriveBacklogConfidence(snapshot = {}) {
  const forecast = snapshot.livePerformanceForecast || snapshot.production?.performanceForecast || {};
  const confidence = text(forecast.confidence || 'low');
  const owner = n(forecast.providerProofP90Ms) > n(forecast.internalRenderMs) ? 'provider' : 'internal';
  return item('backlog_confidence','Backlog confidence',confidence,`${unresolved(snapshot)} unresolved; evidence ${confidence}; dominant observed delay ${owner}.`,confidence==='low'?'neutral':forecast.state==='falling_behind'?'warn':'good');
}
export function deriveTriageSummary(snapshot = {}) {
  const counts = snapshot.inboxTriage?.counts || snapshot.questionOperationsDerived?.counts || {};
  const detail = ['urgent','stale','deferred','pinned','follow_up','proof_pending'].map(key=>`${key.replaceAll('_',' ')} ${n(counts[key])}`).join(' · ');
  return item('triage_summary','Triage summary',n(counts.urgent)||n(counts.stale)?'attention':'clear',detail,n(counts.urgent)||n(counts.stale)?'warn':'good');
}

export function deriveRecoveryEta(snapshot = {}, now = Date.now()) {
  const recovery = snapshot.recoveryProgress || snapshot.recoveryCard || {};
  const dueAt = n(recovery.deadline?.dueAt || recovery.nextDueAt);
  const remaining = dueAt ? Math.max(0,dueAt-now) : 0;
  const budget = snapshot.recoveryBudget || recovery.retryBudget || {};
  return item('recovery_eta','Recovery ETA',recovery.state || (remaining?'waiting':'idle'),dueAt ? `Next recovery check in ${Math.ceil(remaining/1000)}s; ${n(budget.remaining)} retries remain.` : `${n(budget.remaining)} retries remain; no recovery deadline is scheduled.`,recovery.state==='failed'?'warn':'neutral');
}

export function deriveChoiceFreshness(snapshot = {}) {
  const choice = snapshot.operatorChoice;
  if (!choice) return item('choice_freshness','Choice freshness','clear','No unresolved operator choice.','good');
  const current = text(choice.fingerprint);
  const visible = text(snapshot.choiceWorkspace?.fingerprint || choice.fingerprint);
  const stale = Boolean(current && visible && current !== visible);
  return item('choice_freshness','Choice freshness',stale?'stale':'current',stale?'The visible choice no longer matches authoritative state.':'The unresolved choice matches the current snapshot fingerprint.',stale?'warn':'good');
}

export function deriveDockDensity(snapshot = {}) {
  const critical = Boolean(snapshot.operatorChoice || snapshot.deliveryPolicy?.active || snapshot.storagePressure?.level==='critical');
  const attention = critical || unresolved(snapshot)>0 || snapshot.production?.decisionCenter?.primary;
  const density = critical ? 'critical' : attention ? 'attention' : 'compact';
  return item('dock_density','Action Dock density',density,critical?'Critical controls remain expanded.':attention?'Primary action and protected count remain visible.':'Caught-up mode collapses to one compact status line.',critical?'warn':attention?'neutral':'good');
}

export function deriveDisabledActions(snapshot = {}) {
  const availability = snapshot.commandAvailability || snapshot.production?.commandAvailability || {};
  const disabled = Object.entries(availability).filter(([,value])=>value?.enabled===false);
  const sample = disabled.slice(0,3).map(([id,value])=>`${id.replaceAll('_',' ')}: ${text(value.reason || 'unavailable')}`).join(' · ');
  return item('disabled_actions','Disabled actions',disabled.length?'explained':'clear',disabled.length?`${disabled.length} disabled. ${sample}`:'Every visible action is currently available or hidden with a reason.',disabled.length?'neutral':'good');
}

export function deriveIncidentTrend(snapshot = {}) {
  const incidents = snapshot.incidents?.items || [];
  const counts = incidents.reduce((acc,entry)=>{const level=text(entry.severity || 'info');acc[level]=n(acc[level])+1;return acc;},{});
  const high = n(counts.critical)+n(counts.error)+n(counts.high);
  return item('incident_trend','Incident trend',high?'attention':incidents.length?'watch':'clear',`${incidents.length} active · ${high} high severity · ${n(snapshot.incidents?.hiddenCount)} quieted.`,high?'warn':incidents.length?'neutral':'good');
}
export function deriveMilestoneQuality(snapshot = {}) {
  const phase = text(snapshot.liveSession?.phase || 'setup');
  const preflight = snapshot.preflight || snapshot.guidedPreflight || {};
  const checkpoint = snapshot.checkpoint || {};
  const score = [snapshot.contextArmed,preflight.ready || snapshot.readiness?.ready,checkpoint.state==='complete' || checkpoint.complete,phase!=='setup'].filter(Boolean).length;
  return item('milestone_quality','Milestone quality',score>=3?'strong':score>=2?'partial':'incomplete',`${score}/4 safety milestones complete; current phase ${phase}.`,score<2?'warn':score>=3?'good':'neutral');
}

export function deriveFairnessInspector(snapshot = {}) {
  const scheduling = snapshot.batchState?.scheduling || snapshot.receiver?.scheduling || {};
  const wait = n(scheduling.waitMs || scheduling.oldestWaitMs);
  const promoted = Boolean(scheduling.starvationPromoted || scheduling.reason==='starvation_promoted');
  return item('fairness','Batch fairness',promoted?'promoted':wait>60000?'watch':'stable',promoted?`A starved partition was promoted after ${Math.ceil(wait/1000)}s.`:`Oldest eligible partition has waited ${Math.ceil(wait/1000)}s.`,promoted||wait>60000?'warn':'good');
}

export function deriveStorageReclaim(snapshot = {}) {
  const categories = snapshot.storageAccounting || snapshot.storageCategories || {};
  const target = n(snapshot.storagePressure?.targetBytes || snapshot.storagePressure?.softLimitBytes);
  const plan = buildCompactionPlan(categories,target);
  const reclaim = plan.plan.reduce((sum,step)=>sum+n(step.reclaimBytes),0);
  return item('storage_reclaim','Storage reclaim',plan.remainingBytes?'insufficient':reclaim?'available':'not_needed',reclaim?`${reclaim} bytes reclaimable from ${plan.plan.map(step=>step.category).join(', ')}; actionable ownership stays protected.`:'No safe compaction is required.',plan.remainingBytes?'warn':'good');
}

export function deriveWakeHistory(snapshot = {}) {
  const history = snapshot.wakeHistory || snapshot.lifecycle?.wakeHistory || [];
  const latest = history.at?.(-1) || history[history.length-1] || {};
  const failures = history.filter(entry=>entry.outcome && entry.outcome!=='ok').length;
  return item('wake_history','Lifecycle wakes',failures?'review':history.length?'observed':'empty',`${history.length} bounded wake events · ${failures} failed · latest ${text(latest.reason || 'none')}.`,failures?'warn':'neutral');
}

export function deriveProofCoverage(snapshot = {}) {
  const counts = snapshot.ledgerCounts || {};
  const partial = n(snapshot.proofCoverage?.partial || snapshot.partialProofs?.length);
  const total = n(counts.total);
  const proven = n(counts.proven);
  const ratio = total ? Math.round(proven*100/total) : 100;
  return item('proof_coverage','Proof coverage',partial?'partial':unresolved(snapshot)?'in_progress':'complete',`${proven}/${total} ledger entries proven (${ratio}%) · ${partial} partial proof report${partial===1?'':'s'}.`,partial?'warn':unresolved(snapshot)?'neutral':'good');
}

export function deriveKeyboardReadiness(snapshot = {}) {
  const conflicts = snapshot.shortcutConflicts?.conflicts || snapshot.accessibilityProof?.shortcutConflicts || [];
  const focusOk = snapshot.accessibilityProof?.focusReturn !== false;
  const gesture = snapshot.focusGestureState || {};
  const issues = conflicts.length + (focusOk?0:1) + (gesture.expired?1:0);
  return item('keyboard_readiness','Keyboard readiness',issues?'attention':'ready',`${conflicts.length} shortcut conflicts · focus return ${focusOk?'ready':'failed'} · gesture ${gesture.expired?'expired':'safe'}.`,issues?'warn':'good');
}
export function deriveReleaseChecklist(snapshot = {}) {
  const release = snapshot.production?.releaseHandoff || snapshot.releaseHandoff || {};
  const gates = release.gates || [];
  const passed = gates.filter(entry=>entry.ok).length;
  return item('release_checklist','Release readiness',release.ready?'ready':'blocked',`${passed}/${gates.length} release gates pass${release.failed?.length?`; blocked by ${release.failed.join(', ')}`:''}.`,release.ready?'good':'warn');
}

export function derivePacingMonitor(snapshot = {}) {
  const forecast = snapshot.livePerformanceForecast || {};
  const silence = snapshot.liveOperations?.silence || {};
  const growth = n(forecast.intakePerMinute)-n(forecast.proofPerMinute);
  const state = growth>0.25 ? 'accelerating' : unresolved(snapshot)>0 ? 'working' : 'steady';
  const silenceMs = n(silence.elapsedMs || silence.silenceMs);
  return item('pacing','Interview pacing',state,`Queue growth ${growth.toFixed(2)}/min · ${unresolved(snapshot)} protected · interviewer silence ${Math.ceil(silenceMs/1000)}s.`,state==='accelerating'?'warn':'neutral');
}

export function deriveEvidenceSummary(snapshot = {}) {
  const privacy = snapshot.production?.diagnostics?.privacy || {};
  const evidence = snapshot.releaseEvidence || {};
  const included = ['command results','reason codes','latency','counts','UI gates','cleanup'];
  const excluded = ['question text','answer text','setup context','clipboard','credentials','raw URLs'];
  return item('evidence_summary','Evidence export',privacy.safe===false?'blocked':'metadata_only',`Includes ${included.join(', ')}. Excludes ${excluded.join(', ')}. Commit ${text(evidence.commit || 'not bound')}.`,privacy.safe===false?'warn':'good');
}

export function deriveReliabilityCenter(snapshot = {}, now = Date.now()) {
  const items = [
    deriveCommandHealth(snapshot), deriveReplayGuard(snapshot), deriveRouteTransition(snapshot), deriveSessionSafety(snapshot),
    deriveBacklogConfidence(snapshot), deriveTriageSummary(snapshot), deriveRecoveryEta(snapshot,now), deriveChoiceFreshness(snapshot),
    deriveDockDensity(snapshot), deriveDisabledActions(snapshot), deriveIncidentTrend(snapshot), deriveMilestoneQuality(snapshot),
    deriveFairnessInspector(snapshot), deriveStorageReclaim(snapshot), deriveWakeHistory(snapshot), deriveProofCoverage(snapshot),
    deriveKeyboardReadiness(snapshot), deriveReleaseChecklist(snapshot), derivePacingMonitor(snapshot), deriveEvidenceSummary(snapshot)
  ];
  const attention = items.filter(entry=>['warn','blocked','attention','stale','partial','accelerating','insufficient'].includes(entry.tone)||['blocked','attention','stale','partial','accelerating','insufficient'].includes(entry.state)).length;
  return {
    state: attention ? 'attention' : 'healthy',
    attention,
    total: items.length,
    groups: [
      { id:'control', label:'Control and decisions', items:items.slice(0,4) },
      { id:'flow', label:'Flow and recovery', items:items.slice(4,8) },
      { id:'operator', label:'Operator experience', items:items.slice(8,12) },
      { id:'mechanics', label:'Mechanics and proof', items:items.slice(12,16) },
      { id:'release', label:'Access and release', items:items.slice(16,20) }
    ]
  };
}
