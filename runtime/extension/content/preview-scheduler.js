export function createLatestPreviewScheduler({
  send,
  scheduleMicrotask = globalThis.queueMicrotask
}) {
  let queued = null;
  let scheduled = false;
  let stopped = false;

  const flush = async () => {
    scheduled = false;
    if (stopped || !queued) return false;
    const candidate = queued;
    queued = null;
    try {
      return Boolean(await send(candidate));
    } catch {
      return false;
    }
  };

  return {
    push(candidate) {
      if (stopped || !candidate) return false;
      queued = candidate;
      if (!scheduled) {
        scheduled = true;
        scheduleMicrotask(flush);
      }
      return true;
    },
    flush,
    disconnect() {
      stopped = true;
      queued = null;
    }
  };
}
