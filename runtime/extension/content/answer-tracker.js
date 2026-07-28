export function createAnswerTracker({
  beforeText = '',
  startedAt = Date.now(),
  initialHintVersion = 0,
  stabilityMs = 250,
  noGenerationGraceMs = 600
} = {}) {
  const baseline = String(beforeText || '').trim();
  let sawGenerating = false;
  let candidate = '';
  let stableSince = 0;
  let finalized = false;

  return {
    observe({ now = Date.now(), text = '', generating = false, hintVersion = initialHintVersion } = {}) {
      if (finalized) return null;
      if (generating) sawGenerating = true;
      const normalized = String(text || '').trim();
      if (!normalized || normalized === baseline) return null;

      if (normalized !== candidate) {
        candidate = normalized;
        stableSince = now;
      }
      if (generating) return null;

      const hasFinalHint = Number(hintVersion) > Number(initialHintVersion);
      const graceSatisfied = sawGenerating || now - startedAt >= noGenerationGraceMs;
      const stabilitySatisfied = now - stableSince >= stabilityMs;
      if (!hasFinalHint && (!graceSatisfied || !stabilitySatisfied)) return null;

      finalized = true;
      return { text: candidate, elapsedMs: now - startedAt };
    }
  };
}

export function createWakeSignal({
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout
} = {}) {
  const waiters = new Set();
  let disconnected = false;

  const settleAll = reason => {
    for (const waiter of [...waiters]) {
      waiters.delete(waiter);
      clearTimeoutFn(waiter.timer);
      waiter.resolve(reason);
    }
  };

  return {
    wait(timeoutMs = 500) {
      if (disconnected) return Promise.resolve('disconnected');
      return new Promise(resolve => {
        const waiter = { resolve, timer: null };
        waiter.timer = setTimeoutFn(() => {
          if (!waiters.delete(waiter)) return;
          resolve('timeout');
        }, timeoutMs);
        waiters.add(waiter);
      });
    },
    pulse() {
      if (!disconnected) settleAll('signal');
    },
    disconnect() {
      disconnected = true;
      settleAll('disconnected');
    }
  };
}
