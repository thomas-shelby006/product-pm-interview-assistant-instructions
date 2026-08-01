export function deriveInterviewerSilence(snapshot = {}, now = Date.now(), { noticeMs = 25_000, longMs = 60_000 } = {}) {
  const sender = snapshot.sender || {};
  const sourceAt = Number(sender.lastSourceActivityAt || snapshot.liveSession?.lastInterviewerActivityAt || 0);
  const ageMs = sourceAt ? Math.max(0, Number(now) - sourceAt) : 0;
  const captureIssue = ['voice_slow', 'voice_stalled'].includes(String(sender.sourceSilenceState || ''))
    || sender.adapterCapabilityProbation?.writeSafe === false
    || sender.connected === false;
  if (captureIssue) {
    return { state: 'capture_issue', ageMs, thresholdMs: 0, label: 'Capture needs attention', action: 'check_live' };
  }
  if (!sourceAt || snapshot.liveSession?.phase !== 'active') {
    return { state: 'inactive', ageMs: 0, thresholdMs: noticeMs, label: 'Not timing interviewer silence', action: '' };
  }
  if (ageMs >= longMs) return { state: 'long_silence', ageMs, thresholdMs: longMs, label: 'Long interviewer pause', action: 'mark_interviewer_activity' };
  if (ageMs >= noticeMs) return { state: 'quiet', ageMs, thresholdMs: noticeMs, label: 'Interviewer pause', action: '' };
  return { state: 'speaking_recently', ageMs, thresholdMs: noticeMs, label: 'Interviewer active', action: '' };
}
