export function createRuntimeRecovery({
  window,
  document,
  recover,
  scheduleMicrotask = globalThis.queueMicrotask
}) {
  let queued = false;
  let disconnected = false;
  let pendingReason = '';

  const schedule = reason => {
    if (disconnected) return false;
    pendingReason = pendingReason || reason;
    if (queued) return true;
    queued = true;
    scheduleMicrotask(async () => {
      queued = false;
      if (disconnected) return;
      const nextReason = pendingReason || 'runtime_event';
      pendingReason = '';
      try {
        await recover(nextReason);
      } catch (error) {
        console.warn('[PMIA] runtime recovery failed', error);
      }
    });
    return true;
  };
  const onPageShow = () => schedule('pageshow');
  const onOnline = () => schedule('online');
  const onVisibility = () => {
    if (document?.visibilityState === 'visible') schedule('visible');
  };

  window?.addEventListener?.('pageshow', onPageShow);
  window?.addEventListener?.('online', onOnline);
  document?.addEventListener?.('visibilitychange', onVisibility);

  return {
    trigger: schedule,
    disconnect() {
      disconnected = true;
      pendingReason = '';
      window?.removeEventListener?.('pageshow', onPageShow);
      window?.removeEventListener?.('online', onOnline);
      document?.removeEventListener?.('visibilitychange', onVisibility);
    }
  };
}
