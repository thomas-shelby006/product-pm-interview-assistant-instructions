export function createRenderScheduler({
  frame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id),
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = id => clearTimeout(id),
  fallbackMs = 120,
  onError = () => {}
} = {}) {
  let frameHandle = 0;
  let timerHandle = 0;
  let pending = new Set();
  let renderer = null;
  let generation = 0;
  let lastError = '';

  function cancelHandles() {
    if (frameHandle) cancelFrame(frameHandle);
    if (timerHandle) clearTimer(timerHandle);
    frameHandle = 0;
    timerHandle = 0;
  }

  function invoke(current) {
    try {
      renderer(current);
      lastError = '';
      return true;
    } catch (error) {
      lastError = String(error?.message || error || 'render_failed');
      try { onError(error, current); } catch {}
      return false;
    }
  }

  function drain(scheduledGeneration) {
    if (scheduledGeneration !== generation) return;
    cancelHandles();
    const current = [...pending];
    pending.clear();
    if (current.length) invoke(current);
  }

  function schedule(sections = [], render = renderer) {
    renderer = render;
    for (const section of Array.isArray(sections) ? sections : [sections]) {
      if (section) pending.add(String(section));
    }
    if (frameHandle || timerHandle || typeof renderer !== 'function') {
      return frameHandle || timerHandle;
    }
    const scheduledGeneration = generation;
    frameHandle = frame(() => drain(scheduledGeneration));
    timerHandle = setTimer(
      () => drain(scheduledGeneration),
      Math.max(16, Number(fallbackMs) || 120)
    );
    return frameHandle || timerHandle;
  }

  function flush() {
    if (!pending.size || typeof renderer !== 'function') return [];
    cancelHandles();
    generation += 1;
    const current = [...pending];
    pending.clear();
    invoke(current);
    return current;
  }

  function cancel() {
    cancelHandles();
    pending.clear();
    generation += 1;
  }

  return {
    schedule,
    flush,
    cancel,
    snapshot: () => ({
      scheduled: Boolean(frameHandle || timerHandle),
      pending: [...pending],
      generation,
      lastError
    })
  };
}
