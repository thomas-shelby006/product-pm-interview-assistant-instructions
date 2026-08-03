import { DomTurnTracker } from './dom-turn-tracker.js';

export function createProviderSender({
  adapter,
  onPreview,
  onFinal,
  tracker = new DomTurnTracker(),
  isVoiceActive = () => Boolean(adapter.isVoiceActive?.()),
  isComposerEmpty = () => Boolean(adapter.isComposerEmpty?.() ?? true),
  isProviderGenerating = () => Boolean(adapter.isGenerating?.()),
  nowFn = Date.now,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  allowVoiceFallback = false,
  allowFallbackFinalization = String(adapter?.provider || '').toLowerCase() !== 'chatgpt',
  allowPreview = String(adapter?.provider || '').toLowerCase() !== 'chatgpt'
}) {
  let timer = null;
  let stopped = false;

  const invoke = (callback, value, label) => {
    if (!value || stopped) return;
    Promise.resolve(callback?.(value)).catch(error => {
      console.warn(`[PMIA] sender ${label} callback failed`, error);
    });
  };
  const emitFinal = final => invoke(onFinal, final, 'final');
  const emitPreview = preview => invoke(onPreview, preview, 'preview');

  const clearTimer = () => {
    if (timer !== null) clearTimeoutFn(timer);
    timer = null;
  };

  const scheduleFallback = now => {
    clearTimer();
    if (!allowFallbackFinalization) return;
    const voiceActive = isVoiceActive();
    const voiceFallbackAllowed = voiceActive && allowVoiceFallback && tracker.canFinalizeStrongTail?.();
    if (stopped || !isComposerEmpty() || (voiceActive && !voiceFallbackAllowed)) return;
    const delay = tracker.pendingDelay(now);
    if (delay === null) return;
    timer = setTimeoutFn(() => {
      timer = null;
      const activeVoice = isVoiceActive();
      const activeVoiceFallbackAllowed = activeVoice && allowVoiceFallback && tracker.canFinalizeStrongTail?.();
      if (stopped || !isComposerEmpty() || (activeVoice && !activeVoiceFallbackAllowed)) return;
      for (const final of tracker.poll(nowFn(), { allowFallback: true })) emitFinal(final);
    }, delay + 20);
  };

  tracker.prime(adapter.getConversationMessages?.() || []);

  return {
    observe(now = nowFn()) {
      if (stopped) return [];
      const finals = tracker.update(adapter.getConversationMessages?.() || [], now, {
        renderedBoundary: isProviderGenerating()
      });
      const preview = tracker.takePreview?.();
      if (allowPreview && preview) emitPreview(preview);
      for (const final of finals) emitFinal(final);
      scheduleFallback(now);
      return finals;
    },
    markExternalFinal(final) {
      tracker.markExternalFinal(final);
      scheduleFallback(nowFn());
    },
    flushFallback(now = nowFn()) {
      if (!allowFallbackFinalization || stopped || isVoiceActive() || !isComposerEmpty()) return [];
      const finals = tracker.poll(now, { allowFallback: true });
      for (const final of finals) emitFinal(final);
      return finals;
    },
    disconnect() {
      stopped = true;
      clearTimer();
    },
    tracker
  };
}
