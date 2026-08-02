function lane(role = {}) {
  const value = role.transportLane || {};
  const direct = value.lastMode === 'direct' && value.handshakeReady !== false;
  return { state: String(value.state || 'unknown'), mode: String(value.lastMode || value.preferredMode || 'unknown'), score: Math.max(0, Math.min(100, Number(value.score || 0))), rttMs: Math.max(0, Number(value.lastRttMs || 0)), failures: Math.max(0, Number(value.consecutiveFailures || 0)), nextProbeAt: Math.max(0, Number(value.nextProbeAt || 0)), protocolVersion: Number(value.protocolVersion || 0), epoch: Number(value.epoch || 0), direct, connected: Boolean(role.connected), phase: String(role.phase || 'missing') };
}
export function deriveTransportAssurance(snapshot = {}, now = Date.now()) {
  const sender = lane(snapshot.sender); const receiver = lane(snapshot.receiver);
  const correlationGaps = (snapshot.timeline || []).filter(event => ['command_correlation_missing','trace_gap','stale_epoch_rejected'].includes(event?.type)).slice(-10).length;
  const score = Math.round((sender.score + receiver.score) / 2) - Math.min(30, correlationGaps * 5);
  const state = !sender.connected || !receiver.connected ? 'blocked' : sender.failures || receiver.failures ? 'degraded' : sender.direct && receiver.direct ? 'direct' : 'fallback';
  const nextProbeAt = Math.max(sender.nextProbeAt, receiver.nextProbeAt);
  return { state, score: Math.max(0, score), sender, receiver, correlationGaps, nextProbeAt, probeAvailable: nextProbeAt <= now, recommendedCommand: state === 'direct' ? '' : 'probe_transport', evaluatedAt: now };
}
