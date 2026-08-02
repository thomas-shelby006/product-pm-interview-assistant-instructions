import { deriveLiveActionDock } from './live-action-dock-model.js';
import { derivePolicyImpactView } from './policy-impact-preview-model.js';
import { deriveChoiceWorkspace } from './operator-choice-workspace-model.js';
import { deriveInterviewMilestones } from '../shared/interview-milestone-model.js';
import { deriveInboxTriageBoard } from './inbox-triage-board-model.js';
import { deriveProviderRouteDoctor } from '../shared/provider-route-doctor.js';
import { deriveRecoveryRunbookConsole } from './recovery-runbook-console-model.js';
import { deriveCommandHistory } from './command-history-model.js';
import { deriveLivePerformanceForecast } from '../shared/live-performance-forecast.js';
import { deriveSessionWizard } from './session-wizard-model.js';

function node(document,id){ return document.getElementById(id); }
function set(document,id,value){ const target=node(document,id); if(target) target.textContent=String(value ?? ''); }
function replaceList(document,id,items,render){ const target=node(document,id); if(!target) return; target.replaceChildren(); for(const item of items) target.append(render(item)); }
function button(document,label,dataset={}){ const value=document.createElement('button'); value.textContent=label; Object.assign(value.dataset,dataset); return value; }

export function renderLiveAssist({ document, snapshot, state, now = Date.now() }) {
  const dock=deriveLiveActionDock(snapshot || {}); const dockNode=node(document,'liveActionDock');
  if(dockNode){ dockNode.dataset.containment=dock.containment; dockNode.hidden=Boolean(dock.ended); }
  set(document,'dockAnswerState',dock.answer.replaceAll('_',' ')); set(document,'dockWaitingCount',dock.waiting); set(document,'dockDecisionTitle',dock.title); set(document,'dockDecisionDetail',dock.detail); set(document,'dockContainmentState',dock.containment.replaceAll('_',' '));
  const dockAction=node(document,'dockPrimaryAction'); if(dockAction){ dockAction.dataset.actionMode=dock.action.mode || 'inspect'; dockAction.dataset.command=dock.action.command || ''; dockAction.dataset.view=dock.action.view || 'assist'; dockAction.dataset.anchor=dock.action.anchor || 'choiceWorkspace'; dockAction.textContent=dock.action.mode==='choose'?'Choose now':dock.action.mode==='execute'?'Run safe action':'Inspect'; dockAction.disabled=!snapshot || snapshot.mode==='ended'; }

  const choice=deriveChoiceWorkspace(snapshot || {}); set(document,'assistChoiceTitle',choice.title); set(document,'assistChoiceDetail',choice.detail);
  replaceList(document,'assistChoiceOptions',choice.options,item=>button(document,item.label,{ choiceOption:item.id, choiceId:choice.id, fingerprint:choice.fingerprint }));
  const choiceCard=node(document,'choiceWorkspace'); if(choiceCard) choiceCard.dataset.state=choice.visible?'required':'clear';

  const milestones=deriveInterviewMilestones(snapshot || {},now); set(document,'assistMilestoneState',milestones.phase);
  replaceList(document,'assistMilestones',milestones.items,item=>{ const el=button(document,item.label,{ milestone:item.id }); el.disabled=!item.available; el.setAttribute('aria-current',item.current?'step':'false'); el.dataset.completed=String(item.completed); return el; });

  const triage=deriveInboxTriageBoard(snapshot || {},now,state.assistTriageView || 'urgent'); set(document,'assistTriageCount',triage.items.length);
  replaceList(document,'assistTriageViews',triage.views,item=>{ const el=button(document,`${item.replaceAll('_',' ')} ${triage.counts[item]}`,{ triageView:item }); el.setAttribute('aria-pressed',String(item===triage.selectedView)); return el; });
  replaceList(document,'assistTriageItems',triage.items.slice(0,20),item=>{ const el=document.createElement('li'); el.textContent=`#${item.seq} · ${item.priority} · ${item.state} · ${Math.round(item.ageMs/1000)}s`; el.dataset.itemId=item.id; return el; });

  const doctor=deriveProviderRouteDoctor(snapshot || {}); set(document,'assistRouteState',doctor.state); set(document,'assistRouteDetail',`${doctor.route}. ${doctor.explanation}`); set(document,'assistRouteIssues',doctor.issues.length?doctor.issues.join(' · '):'No route issues.'); const doctorAction=node(document,'assistRouteAction'); if(doctorAction){ doctorAction.hidden=!doctor.recommendedCommand; doctorAction.dataset.command=doctor.recommendedCommand; }

  const recovery=deriveRecoveryRunbookConsole(snapshot || {},now); set(document,'assistRecoveryState',`${recovery.complete}/${recovery.total} · ${recovery.state}`); set(document,'assistRecoveryDetail',`Cause ${recovery.reason.replaceAll('_',' ')}. Retry budget ${recovery.retryBudget.remaining}/${recovery.retryBudget.max}.${recovery.deadline?` Next ${recovery.deadline.kind} in ${Math.ceil(recovery.deadline.dueInMs/1000)}s.`:''}`); replaceList(document,'assistRecoverySteps',recovery.steps,item=>{ const el=document.createElement('li'); el.textContent=`${item.complete?'✓':'○'} ${item.label}`; return el; }); const recoveryAction=node(document,'assistRecoveryAction'); if(recoveryAction){ recoveryAction.hidden=!recovery.command; recoveryAction.dataset.command=recovery.command; }

  const history=deriveCommandHistory(snapshot || {},state.assistCommandQuery || ''); set(document,'assistCommandSummary',`${history.successes} successful · ${history.failures} failed · ${history.replays} replayed`); replaceList(document,'assistCommandHistory',history.items.slice(0,30),item=>{ const el=document.createElement('li'); el.textContent=`${item.command.replaceAll('_',' ')} · ${item.ok?'OK':item.error || 'failed'} · ${item.durationMs}ms${item.replayCount?` · replay ${item.replayCount}`:''}`; if(item.reversible){ const undo=button(document,'Undo',{ undoId:item.undoId }); el.append(' ',undo); } return el; });

  const forecast=deriveLivePerformanceForecast(snapshot || {},now); set(document,'assistForecastState',`${forecast.state.replaceAll('_',' ')} · ${forecast.confidence} confidence`); set(document,'assistForecastDetail',`${forecast.unresolved} unresolved. Intake ${forecast.intakePerMinute}/min, proof ${forecast.proofPerMinute}/min.${forecast.estimatedCatchUpMs===null?' Catch-up unavailable.':` Catch-up ${Math.ceil(forecast.estimatedCatchUpMs/1000)}s.`}`); const forecastAction=node(document,'assistForecastAction'); if(forecastAction){ forecastAction.hidden=!forecast.recommendedProfile; forecastAction.dataset.profile=forecast.recommendedProfile; forecastAction.textContent=`Preview ${forecast.recommendedProfile}`; }

  const preview=derivePolicyImpactView(state.policyPreview || null); set(document,'assistPolicyTitle',preview.title); set(document,'assistPolicySummary',preview.summary); replaceList(document,'assistPolicyChanges',preview.changes,item=>{ const el=document.createElement('li'); el.textContent=item; return el; }); const confirm=node(document,'assistPolicyConfirm'); if(confirm){ confirm.hidden=!preview.visible; confirm.disabled=!preview.allowed; }

  const wizard=deriveSessionWizard(snapshot || {},state.assistWizardStage || 'start'); set(document,'assistWizardTitle',wizard.title); set(document,'assistWizardProgress',`${wizard.complete}/${wizard.total}`); replaceList(document,'assistWizardSteps',wizard.steps,item=>{ const el=document.createElement('li'); el.textContent=`${item.complete?'✓':'○'} ${item.label}`; if(!item.complete && item.command){ const act=button(document,'Run',{ command:item.command }); el.append(' ',act); } return el; });
}