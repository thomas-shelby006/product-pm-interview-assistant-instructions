import { createAnswerTracker } from './answer-tracker.js';
import { reconcileGenerationTruth } from './generation-truth.js';
import { createAnswerLifecycle, isTerminalAnswerState } from './answer-lifecycle.js';
import { deriveAnswerDeadline } from './answer-timeout-policy.js';

export function createReceiverAnswerOrchestrator({
  adapter,
  wake = { async wait() {} },
  now = Date.now,
  getHintVersion = () => 0,
  onAnswerState = () => {},
  onAnswer = () => {},
  onTerminal = () => {},
  log = async () => {},
  setStatus = () => {},
  scroll = () => {},
  limits = { startGraceMs: 8000, streamStallMs: 20000, hardCapMs: 120000 }
} = {}) {
  let token = 0;
  let activeToken = 0;
  let terminalToken = 0;
  let lifecycle = createAnswerLifecycle();
  let answerState = lifecycle.snapshot();
  let generationState = reconcileGenerationTruth({ now: now() });
  let lastAssistantText = String(adapter?.getLatestAssistantText?.() || '');
  let lastHintVersion = Number(getHintVersion() || 0);

  function emitState(value) {
    answerState = value ? { ...value } : null;
    onAnswerState(answerState ? { ...answerState } : null);
    return answerState;
  }

  function emitTerminal(result) {
    if (terminalToken === activeToken) return result;
    terminalToken = activeToken;
    onTerminal(result);
    return result;
  }

  function observeGeneration() {
    const text = String(adapter?.getLatestAssistantText?.() || '');
    const hintVersion = Number(getHintVersion() || 0);
    const textChanged = Boolean(text && text !== lastAssistantText);
    const finalHintChanged = hintVersion !== lastHintVersion;
    generationState = reconcileGenerationTruth({
      adapterGenerating: Boolean(adapter?.isGenerating?.()),
      stopAvailable: Boolean(adapter?.hasStopControl?.()),
      textChanged,
      finalHintChanged,
      previous: generationState,
      now: now()
    });
    if (text) lastAssistantText = text;
    lastHintVersion = hintVersion;
    return { truth: { ...generationState }, text, textChanged, finalHintChanged };
  }

  function prepare({ envelope } = {}) {
    activeToken = ++token;
    terminalToken = 0;
    lifecycle = createAnswerLifecycle();
    emitState(lifecycle.transition({ type: 'start', batchId: envelope?.id || '', at: now() }));
    return { token: activeToken, answerState: { ...answerState } };
  }

  function cancel(reason = 'answer_cancelled') {
    if (isTerminalAnswerState(answerState)) return { ok: false, cancelled: true, answerState: { ...answerState } };
    token += 1;
    emitState(lifecycle.transition({ type: 'cancel', at: now(), reason }));
    return emitTerminal({ ok: false, cancelled: true, answerState: { ...answerState } });
  }

  async function start({ envelope, beforeText = '', hintVersionAtStart = Number(getHintVersion() || 0) } = {}) {
    const prepared = prepare({ envelope });
    const captureToken = prepared.token;
    const startedAt = Number(answerState.startedAt || now());
    const tracker = createAnswerTracker({
      beforeText,
      startedAt,
      initialHintVersion: hintVersionAtStart,
      stabilityMs: 250,
      noGenerationGraceMs: 600
    });
    while (captureToken === activeToken && captureToken === token) {
      const observed = observeGeneration();
      const current = now();
      if (observed.textChanged && observed.text && observed.text !== beforeText) {
        emitState(lifecycle.transition({
          type: 'stream',
          at: current,
          wordCount: observed.text.split(/\s+/).filter(Boolean).length,
          reason: observed.truth.reason
        }));
      }
      const result = tracker.observe({
        now: current,
        text: observed.text,
        generating: observed.truth.generating,
        hintVersion: Number(getHintVersion() || 0)
      });
      if (result) {
        const words = result.text.split(/\s+/).filter(Boolean).length;
        emitState(lifecycle.transition({ type: 'complete', at: current, wordCount: words }));
        await log('answer', { envelopeId: envelope?.id || '', text: result.text, wordCount: words, elapsedMs: result.elapsedMs });
        onAnswer({ envelopeId: envelope?.id || '', text: result.text, wordCount: words, elapsedMs: result.elapsedMs });
        setStatus(`ANSWER ${words}w`, 'ok', 1800);
        scroll();
        return emitTerminal({ ok: true, text: result.text, wordCount: words, elapsedMs: result.elapsedMs, answerState: { ...answerState } });
      }
      const deadline = deriveAnswerDeadline({ ...answerState, now: current, limits });
      if (deadline.terminal) {
        const eventType = deadline.state === 'no_response' ? 'no_response' : 'timeout';
        emitState(lifecycle.transition({ type: eventType, at: current, reason: deadline.reason }));
        await log(deadline.state === 'no_response' ? 'answer_no_response' : 'answer_timeout', { envelopeId: envelope?.id || '', reason: deadline.reason });
        setStatus(deadline.state === 'no_response' ? 'NO ANSWER OBSERVED' : 'ANSWER TIMEOUT', 'warn', 2500);
        return emitTerminal({
          ok: false,
          noResponse: deadline.state === 'no_response',
          timeout: deadline.state === 'timed_out',
          answerState: { ...answerState }
        });
      }
      await wake.wait(Math.min(500, Math.max(1, deadline.nextCheckMs)));
    }
    return cancel('capture_superseded');
  }

  function snapshot() {
    return {
      answerState: answerState ? { ...answerState } : null,
      generationState: { ...generationState },
      active: activeToken > 0 && !isTerminalAnswerState(answerState)
    };
  }

  return { start, prepare, cancel, observeGeneration, snapshot };
}