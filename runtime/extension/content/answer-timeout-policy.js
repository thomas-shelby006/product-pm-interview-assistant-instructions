const TERMINAL = new Set(['complete', 'no_response', 'timed_out', 'cancelled']);

export function deriveAnswerDeadline({
  state = 'waiting',
  startedAt = 0,
  firstTokenAt = 0,
  lastEvidenceAt = 0,
  now = Date.now(),
  limits = {}
} = {}) {
  const startGraceMs = Math.max(0, Number(limits.startGraceMs ?? 8000));
  const streamStallMs = Math.max(0, Number(limits.streamStallMs ?? 20000));
  const hardCapMs = Math.max(1, Number(limits.hardCapMs ?? 120000));
  const current = String(state || 'waiting');
  const at = Number(now);
  const start = Number(startedAt || 0);
  if (TERMINAL.has(current)) return { terminal: true, state: current, reason: '', nextCheckMs: 0, deadlineAt: at };
  const hardDeadline = start + hardCapMs;
  if (start && at >= hardDeadline) {
    return { terminal: true, state: 'timed_out', reason: 'answer_hard_timeout', nextCheckMs: 0, deadlineAt: hardDeadline };
  }
  if (current === 'streaming' || Number(firstTokenAt) > 0) {
    const evidenceAt = Number(lastEvidenceAt || firstTokenAt || start);
    const stallDeadline = evidenceAt + streamStallMs;
    if (at >= stallDeadline) {
      return { terminal: true, state: 'timed_out', reason: 'answer_stream_stalled', nextCheckMs: 0, deadlineAt: stallDeadline };
    }
    const deadlineAt = Math.min(stallDeadline, hardDeadline);
    return { terminal: false, state: 'streaming', reason: '', nextCheckMs: Math.max(1, deadlineAt - at), deadlineAt };
  }
  const startDeadline = start + startGraceMs;
  if (at >= startDeadline) {
    return { terminal: true, state: 'no_response', reason: 'answer_never_started', nextCheckMs: 0, deadlineAt: startDeadline };
  }
  const deadlineAt = Math.min(startDeadline, hardDeadline);
  return { terminal: false, state: 'waiting', reason: '', nextCheckMs: Math.max(1, deadlineAt - at), deadlineAt };
}