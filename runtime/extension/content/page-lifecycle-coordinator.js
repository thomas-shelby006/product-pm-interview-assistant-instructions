export function createPageLifecycleCoordinator({ window, document, reconcile, scheduleMicrotask = globalThis.queueMicrotask } = {}) {
  let phase = document?.visibilityState === 'hidden' ? 'hidden' : 'active';
  let queued = false; let disconnected = false; const pending = new Set(); let lastTransitionAt = Date.now();
  const queue = reason => {
    if (disconnected) return false;
    pending.add(String(reason || 'lifecycle_event'));
    if (queued) return true;
    queued = true;
    scheduleMicrotask(async () => {
      queued = false;
      if (disconnected) return;
      const reasons = [...pending]; pending.clear();
      const priority = ['bfcache_restore', 'discarded_reload', 'resume', 'online', 'visible', 'pageshow'];
      const selected = priority.find(value => reasons.includes(value)) || reasons[0] || 'lifecycle_event';
      try { await reconcile(selected, { reasons, phase }); } catch (error) { console.warn('[PMIA] lifecycle reconcile failed', error); }
    });
    return true;
  };
  const transition = next => { phase = next; lastTransitionAt = Date.now(); };
  const onPageShow = event => { transition('active'); queue(event?.persisted ? 'bfcache_restore' : 'pageshow'); };
  const onPageHide = event => { transition(event?.persisted ? 'bfcache' : 'hidden'); };
  const onFreeze = () => transition('frozen');
  const onResume = () => { transition(document?.visibilityState === 'hidden' ? 'hidden' : 'active'); queue('resume'); };
  const onOnline = () => queue('online');
  const onVisibility = () => { transition(document?.visibilityState === 'visible' ? 'active' : 'hidden'); if (phase === 'active') queue('visible'); };
  window?.addEventListener?.('pageshow', onPageShow); window?.addEventListener?.('pagehide', onPageHide); window?.addEventListener?.('online', onOnline);
  document?.addEventListener?.('freeze', onFreeze); document?.addEventListener?.('resume', onResume); document?.addEventListener?.('visibilitychange', onVisibility);
  return {
    trigger: queue,
    snapshot: () => ({ phase, queued, pendingReasons: [...pending], lastTransitionAt }),
    disconnect() {
      disconnected = true; pending.clear();
      window?.removeEventListener?.('pageshow', onPageShow); window?.removeEventListener?.('pagehide', onPageHide); window?.removeEventListener?.('online', onOnline);
      document?.removeEventListener?.('freeze', onFreeze); document?.removeEventListener?.('resume', onResume); document?.removeEventListener?.('visibilitychange', onVisibility);
    }
  };
}