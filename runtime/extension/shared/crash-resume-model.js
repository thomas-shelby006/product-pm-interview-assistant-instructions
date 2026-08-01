export function deriveCrashResume(snapshot = {}, now = Date.now()) {
  const checkpoint = snapshot.checkpoint || null;
  const ended = snapshot.mode === 'ended' || Boolean(snapshot.endedAt) || snapshot.liveSession?.phase === 'ended';
  const roleMissing = ['sender','receiver'].some(role => ['missing','boot','registered'].includes(String(snapshot?.[role]?.phase || 'missing')));
  const interrupted = ['repairing','degraded','blocked'].includes(String(snapshot.mode || '')) || roleMissing;
  const unresolved = Math.max(0, Number(snapshot.ledgerCounts?.pending || 0) + Number(snapshot.ledgerCounts?.inFlight || 0));
  const checkpointAgeMs = checkpoint?.at ? Math.max(0, Number(now) - Number(checkpoint.at)) : 0;
  const dismissedAt = Math.max(0, Number(snapshot.crashResumeDismissedAt || 0));
  const visible = Boolean(!ended && checkpoint && interrupted && Number(checkpoint.at || 0) > dismissedAt);
  return {
    visible,
    reason: roleMissing ? 'managed_role_restarted' : interrupted ? 'runtime_interrupted' : '',
    checkpoint,
    checkpointAgeMs,
    unresolved,
    action: visible ? 'resume_live_session' : '',
    dismissAction: visible ? 'dismiss_crash_resume' : ''
  };
}
