function uniqueTargets(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function sameTargets(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function createProviderObserver({
  adapter,
  document,
  onCandidate,
  onChange,
  MutationObserverCtor = globalThis.MutationObserver,
  scheduleMicrotask = globalThis.queueMicrotask,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
  watchdogMs = 500
}) {
  let observer = null;
  let targets = [];
  let queued = false;
  let disposed = false;

  const emit = () => {
    if (disposed) return;
    const hidden = document?.visibilityState === 'hidden';
    if (hidden && !adapter.isVoiceActive?.()) return;
    if (typeof onChange === 'function') {
      onChange();
      return;
    }
    const candidate = adapter.getSenderCandidateInfo?.();
    if (candidate?.text && typeof onCandidate === 'function') onCandidate(candidate);
  };

  const schedule = () => {
    if (disposed || queued) return;
    queued = true;
    scheduleMicrotask(() => {
      queued = false;
      emit();
    });
  };

  const bindTargets = () => {
    const next = uniqueTargets(adapter.getObservationTargets?.());
    if (sameTargets(targets, next)) return;
    observer?.disconnect();
    observer = null;
    targets = next;
    if (!MutationObserverCtor || !targets.length) return;
    observer = new MutationObserverCtor(schedule);
    for (const target of targets) {
      observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  };

  bindTargets();
  emit();
  const watchdog = setIntervalFn(() => {
    bindTargets();
    emit();
  }, watchdogMs);

  return {
    flush: emit,
    refresh() {
      bindTargets();
      emit();
    },
    disconnect() {
      disposed = true;
      observer?.disconnect();
      observer = null;
      targets = [];
      clearIntervalFn(watchdog);
    }
  };
}
