export function deriveSessionEndView(prepared = {}) {
  const counts = prepared?.counts || {};
  const actionable = Math.max(0, Number(counts.actionable || 0));
  const inFlight = Math.max(0, Number(counts.inFlight || 0));
  const unpersisted = Math.max(0, Number(counts.unpersisted || 0));
  const liveActive = Math.max(0, Number(counts.liveActive || 0));
  const phase = String(counts.phase || 'setup');
  return {
    blocked: !prepared?.canEnd,
    token: String(prepared?.token || ''),
    expiresAt: Number(prepared?.expiresAt || 0),
    counts: { actionable, inFlight, unpersisted, liveActive, phase },
    summary: `${actionable} unresolved final(s), ${inFlight} in flight, ${unpersisted} sender outbox item(s)${liveActive ? `, live phase ${phase}` : ''}.`
  };
}
