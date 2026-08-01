export function runConsistencyAudit({ snapshot = {}, storeAudit = {}, registry = null, alarms = [], now = Date.now() } = {}) {
  const repairs = [];
  const blocked = [];
  const sessionId = String(snapshot?.sessionId || '');
  if (!sessionId) blocked.push({ code: 'session_missing' });
  if (Number(storeAudit?.blocked || 0) > 0) blocked.push({ code: 'state_store_blocked', count: Number(storeAudit.blocked) });
  if (snapshot?.ledgerIndexAudit?.ok === false) repairs.push({ code: 'rebuild_ledger_index' });
  for (const entry of snapshot?.ledger || []) {
    const lease = entry?.attemptLease;
    if (lease?.expiresAt && Number(lease.expiresAt) <= Number(now)) {
      repairs.push({ code: 'release_expired_attempt_lease', ledgerItemId: String(entry.id || '') });
    }
  }
  const registered = registry?.getSession?.(sessionId) || null;
  for (const role of ['sender','receiver']) {
    if (snapshot?.[role]?.connected && !registered?.[role]) repairs.push({ code: 're_register_role', role });
  }
  const expectedAlarms = new Set((snapshot?.recoverySchedules || []).map(item => String(item.alarmName || '')).filter(Boolean));
  const actualAlarms = new Set((alarms || []).map(item => String(item.name || '')).filter(Boolean));
  for (const name of expectedAlarms) if (!actualAlarms.has(name)) repairs.push({ code: 'restore_alarm', alarmName: name });
  if (snapshot?.batchState?.active && snapshot?.batchState?.next?.memberIds?.some(id => snapshot.batchState.active.memberIds?.includes(id))) blocked.push({ code: 'ambiguous_batch_membership' });
  return { ok: blocked.length === 0, repairs, blocked, reason: blocked[0]?.code || repairs[0]?.code || 'consistent', evaluatedAt: Number(now) || Date.now() };
}
