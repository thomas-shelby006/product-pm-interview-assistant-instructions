export function deriveSelfTestView(snapshot, now = Date.now(), freshMs = 30000) {
  const value = snapshot?.selfTest || null;
  if (!value) return { state: 'missing', label: 'Not run', fresh: false, ageMs: 0, detail: 'Run the active no-content pulse before relying on Ready.' };
  const ageMs = value.completedAt ? Math.max(0, Number(now) - Number(value.completedAt)) : Infinity;
  const fresh = value.ok === true && ageMs <= freshMs;
  const state = value.ok !== true ? 'failed' : fresh ? 'passed' : 'stale';
  const role = (name, label) => `${label} ${Number(value.roles?.[name]?.rttMs || 0)} ms`;
  return {
    state,
    label: state === 'passed' ? 'Passed' : state === 'failed' ? 'Failed' : 'Stale',
    fresh,
    ageMs: Number.isFinite(ageMs) ? ageMs : 0,
    detail: `${role('sender', 'Window 1')}; ${role('receiver', 'Window 2')}; storage ${Number(value.storage?.rttMs || 0)} ms; dashboard ${value.dashboard?.connected ? 'connected' : 'missing'}.`
  };
}
