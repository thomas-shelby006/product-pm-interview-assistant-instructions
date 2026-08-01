import { deriveSelfTestTrust } from './self-test-trust-model.js';

export function deriveSelfTestView(snapshot, now = Date.now()) {
  const value = snapshot?.selfTest || null;
  const trust = deriveSelfTestTrust(snapshot, now);
  if (!value) return { ...trust, label: 'Not run', fresh: false, detail: trust.detail };
  const role = (name, label) => `${label} ${Number(value.roles?.[name]?.rttMs || 0)} ms`;
  const labels = { active: 'Passed', evidence_fresh: 'Evidence fresh', stale: 'Stale', failed: 'Failed', missing: 'Not run' };
  return {
    ...trust,
    label: labels[trust.state] || 'Unknown',
    fresh: ['active', 'evidence_fresh'].includes(trust.state),
    detail: `${role('sender', 'Window 1')}; ${role('receiver', 'Window 2')}; storage ${Number(value.storage?.rttMs || 0)} ms; dashboard ${value.dashboard?.connected ? 'connected' : 'missing'}. ${trust.detail}`
  };
}