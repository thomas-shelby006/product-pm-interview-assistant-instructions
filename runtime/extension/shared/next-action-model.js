import { deriveAttentionTarget } from './attention-model.js';
import { deriveInterviewRunbook } from './interview-runbook.js';

const LABELS = Object.freeze({
  check_live: 'Check live health', repair_runtime: 'Repair runtime', resume_catch_up: 'Resume and catch up',
  run_self_test: 'Run self-test', resend_context: 'Resend session context', resolve_draft_restore_pmia: 'Resolve receiver draft',
  resolve_no_response: 'Resolve no response', start_mock: 'Start mock interview', prepare_end_session: 'Prepare debrief'
});

export function deriveNextAction(snapshot = {}, now = Date.now()) {
  const attention = deriveAttentionTarget(snapshot, now);
  const runbook = deriveInterviewRunbook(snapshot, now);
  let command = String(attention.action || '');
  let reason = String(attention.reason || 'caught_up');
  if (!command && snapshot.liveSession?.phase === 'setup') {
    command = runbook.ready ? 'start_mock' : String(runbook.next?.action || 'check_live');
    reason = runbook.ready ? 'preflight_complete' : String(runbook.next?.id || 'setup_incomplete');
  } else if (!command && snapshot.liveSession?.phase === 'debrief') {
    command = 'prepare_end_session';
    reason = 'debrief_ready';
  }
  return {
    command,
    label: LABELS[command] || (command ? command.replaceAll('_', ' ') : 'No action required'),
    reason,
    severity: attention.severity,
    target: attention.target,
    available: Boolean(command),
    evidence: attention.evidence || {},
    evaluatedAt: Number(now)
  };
}
