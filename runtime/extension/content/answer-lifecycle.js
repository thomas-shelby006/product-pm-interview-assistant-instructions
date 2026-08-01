const TERMINAL = new Set(['complete', 'no_response', 'timed_out', 'cancelled']);

function normalized(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    batchId: String(source.batchId || ''),
    state: String(source.state || 'idle'),
    startedAt: Math.max(0, Number(source.startedAt || 0)),
    firstTokenAt: Math.max(0, Number(source.firstTokenAt || 0)),
    completedAt: Math.max(0, Number(source.completedAt || 0)),
    lastEvidenceAt: Math.max(0, Number(source.lastEvidenceAt || 0)),
    reason: String(source.reason || ''),
    wordCount: Math.max(0, Number(source.wordCount || 0)),
    elapsedMs: Math.max(0, Number(source.elapsedMs || 0))
  };
}

export function isTerminalAnswerState(value) {
  return TERMINAL.has(String(value?.state || value || ''));
}

export function createAnswerLifecycle(initial = {}) {
  let state = normalized(initial);
  const snapshot = () => ({ ...state });
  const transition = (event = {}) => {
    if (isTerminalAnswerState(state)) return snapshot();
    const type = String(event.type || '');
    const at = Math.max(0, Number(event.at || Date.now()));
    if (type === 'start') {
      state = normalized({ ...state, batchId: event.batchId || state.batchId, state: 'waiting', startedAt: at, lastEvidenceAt: at });
    } else if (type === 'stream') {
      state = normalized({
        ...state,
        state: 'streaming',
        firstTokenAt: state.firstTokenAt || at,
        lastEvidenceAt: at,
        wordCount: event.wordCount ?? state.wordCount,
        reason: String(event.reason || 'assistant_text_growth')
      });
    } else if (type === 'complete') {
      state = normalized({ ...state, state: 'complete', completedAt: at, lastEvidenceAt: at, reason: String(event.reason || 'answer_complete'), wordCount: event.wordCount ?? state.wordCount, elapsedMs: Math.max(0, at - state.startedAt) });
    } else if (type === 'no_response') {
      state = normalized({ ...state, state: 'no_response', completedAt: at, reason: String(event.reason || 'answer_never_started'), elapsedMs: Math.max(0, at - state.startedAt) });
    } else if (type === 'timeout') {
      state = normalized({ ...state, state: 'timed_out', completedAt: at, reason: String(event.reason || 'answer_timeout'), elapsedMs: Math.max(0, at - state.startedAt) });
    } else if (type === 'cancel') {
      state = normalized({ ...state, state: 'cancelled', completedAt: at, reason: String(event.reason || 'answer_cancelled'), elapsedMs: Math.max(0, at - state.startedAt) });
    }
    return snapshot();
  };
  return { transition, snapshot };
}