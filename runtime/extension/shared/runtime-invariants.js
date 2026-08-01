function clone(value) {
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

function dedupeBy(values, keyOf) {
  const seen = new Set(); const output = []; let removed = 0;
  for (const value of Array.isArray(values) ? values : []) {
    const key = String(keyOf(value) || '');
    if (key && seen.has(key)) { removed += 1; continue; }
    if (key) seen.add(key);
    output.push(value);
  }
  return { output, removed };
}

export function validateRuntimeState(records = [], now = Date.now()) {
  const state = clone(Array.isArray(records) ? records : []);
  const findings = [];
  let repaired = 0; let blocked = 0;
  for (const session of state) {
    const sessionId = String(session?.sessionId || '');
    const ledger = dedupeBy(session?.ledger, entry => entry?.id || entry?.envelope?.id);
    if (ledger.removed) {
      session.ledger = ledger.output;
      repaired += ledger.removed;
      findings.push({ sessionId, severity: 'repaired', code: 'duplicate_ledger_identity', count: ledger.removed });
    }
    const schedules = dedupeBy(session?.recoverySchedules, item => item?.alarmName);
    if (schedules.removed) {
      session.recoverySchedules = schedules.output;
      repaired += schedules.removed;
      findings.push({ sessionId, severity: 'repaired', code: 'duplicate_recovery_schedule', count: schedules.removed });
    }
    for (const entry of session?.ledger || []) {
      const lease = entry?.attemptLease;
      if (lease && Number(lease.expiresAt || 0) <= Number(now)) {
        entry.attemptLease = null;
        repaired += 1;
        findings.push({ sessionId, severity: 'repaired', code: 'expired_attempt_lease', entryId: String(entry.id || '') });
      }
    }
    const ledgerIds = new Set((session?.ledger || []).map(entry => String(entry?.id || entry?.envelope?.id || '')).filter(Boolean));
    const activeMembers = Array.isArray(session?.batchState?.active?.memberIds)
      ? session.batchState.active.memberIds.map(String)
      : [];
    const missing = activeMembers.filter(id => !ledgerIds.has(id));
    if (missing.length) {
      blocked += 1;
      findings.push({ sessionId, severity: 'blocked', code: 'batch_member_missing_from_ledger', memberIds: missing });
    }
    const outboxCount = Math.max(0, Number(session?.senderOutboxState?.count || 0));
    if (session?.senderOutboxState && outboxCount === 0 && session.senderOutboxState.retryIntent) {
      session.senderOutboxState.retryIntent = null;
      repaired += 1;
      findings.push({ sessionId, severity: 'repaired', code: 'empty_outbox_retry_intent' });
    }
  }
  return { state, findings, repaired, blocked, ok: blocked === 0 };
}