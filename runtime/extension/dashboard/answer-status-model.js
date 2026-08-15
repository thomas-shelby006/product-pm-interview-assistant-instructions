const SPOKEN_WPM = 129;
const HARD_CAP_WORDS = 180;

function elapsedLabel(ms) {
  const seconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  return `${seconds}s`;
}

function speechTimeLabel(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  if (safeSeconds < 60) return `${safeSeconds}s`;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function answerLengthFacts(wordCount) {
  const words = Math.max(0, Number(wordCount || 0));
  const estimatedSpeechSeconds = Math.round((words / SPOKEN_WPM) * 60);
  const overByWords = Math.max(0, words - HARD_CAP_WORDS);
  return {
    wordCount: words,
    estimatedSpeechSeconds,
    overByWords,
    lengthState: overByWords ? 'over_cap' : 'within_cap'
  };
}

function lengthDetail(facts) {
  if (facts.overByWords) {
    const noun = facts.overByWords === 1 ? 'word' : 'words';
    return `about ${speechTimeLabel(facts.estimatedSpeechSeconds)} spoken at ${SPOKEN_WPM} WPM; ${facts.overByWords} ${noun} over the ${HARD_CAP_WORDS}-word hard cap`;
  }
  return `about ${speechTimeLabel(facts.estimatedSpeechSeconds)} spoken at ${SPOKEN_WPM} WPM; within the ${HARD_CAP_WORDS}-word hard cap`;
}

export function deriveAnswerStatus(snapshot, now = Date.now()) {
  const answer = snapshot?.answerState || null;
  const active = snapshot?.batchState?.active || null;
  const generation = snapshot?.receiver?.generationState || null;
  const state = String(answer?.state || (active ? 'awaiting_observation' : 'idle'));
  const generating = Boolean(generation?.generating && generation?.state === 'streaming');
  const confidence = String(generation?.confidence || 'high');
  if (state === 'idle') {
    return { state, label: 'Idle', title: 'No answer in progress', detail: 'Window 2 is ready for the next proven batch.', generating: false, confidence };
  }
  if (state === 'awaiting_observation') {
    return { state, label: 'Observing', title: 'Rendered batch awaiting answer evidence', detail: 'Delivery proof is complete; answer observation has not started.', generating, confidence };
  }
  if (state === 'waiting') {
    const age = Math.max(0, Number(now) - Number(answer?.startedAt || now));
    return {
      state,
      label: 'Waiting',
      title: 'Waiting for answer evidence',
      detail: `${elapsedLabel(age)} since rendered submission; generation evidence is ${generation?.reason || 'not observed'}.`,
      generating,
      confidence
    };
  }
  if (state === 'streaming') {
    const length = answerLengthFacts(answer?.wordCount);
    return {
      state,
      label: 'Streaming',
      title: 'Answer is being observed',
      detail: `${length.wordCount} words observed; ${lengthDetail(length)}; evidence ${generation?.reason || 'assistant activity'} (${confidence} confidence).`,
      generating,
      confidence,
      ...length
    };
  }
  if (state === 'complete' && Number(answer?.wordCount || 0) > 0) {
    const length = answerLengthFacts(answer?.wordCount);
    return {
      state,
      label: 'Complete',
      title: 'Answer captured',
      detail: `${length.wordCount} words captured; ${lengthDetail(length)}.`,
      generating: false,
      confidence,
      ...length
    };
  }
  const terminal = {
    complete: ['Complete', 'Answer captured', 'Window 2 answer completed and metrics were recorded.'],
    no_response: ['No response', 'No answer began', `Rendered delivery succeeded, but no answer evidence began${answer?.reason ? `: ${String(answer.reason).replaceAll('_', ' ')}` : '.'}`],
    timed_out: ['Timed out', 'Answer observation timed out', `Rendered delivery succeeded; answer observation ended${answer?.reason ? `: ${String(answer.reason).replaceAll('_', ' ')}` : '.'}`],
    cancelled: ['Cancelled', 'Answer observation cancelled', `A newer runtime action ended observation${answer?.reason ? `: ${String(answer.reason).replaceAll('_', ' ')}` : '.'}`]
  }[state] || ['Unknown', 'Answer state unavailable', 'The delivery ledger remains authoritative.'];
  return { state, label: terminal[0], title: terminal[1], detail: terminal[2], generating: false, confidence };
}