const IMMEDIATE = new Set([
  'final_persisted', 'batch_proven', 'receiver_proof', 'session_end',
  'storage_pressure', 'archive', 'command_result'
]);
const COALESCED = new Set([
  'preview', 'next_batch_draft', 'batch_checkpoint', 'semantic_telemetry'
]);

export function classifyPersistence(event = {}) {
  const type = String(event?.type || event || '');
  if (IMMEDIATE.has(type)) return 'immediate';
  if (COALESCED.has(type)) return 'coalesced';
  if (type === 'heartbeat') return 'heartbeat';
  return 'coalesced';
}

export function createCoalescedCommitLane({
  commit,
  delayMs = 140,
  setTimer = setTimeout,
  clearTimer = clearTimeout
} = {}) {
  if (typeof commit !== 'function') throw new TypeError('Coalesced commit lane requires commit');
  const sessions = new Map();

  async function flush(sessionId) {
    const key = String(sessionId || '');
    const pending = sessions.get(key);
    if (!pending) return false;
    if (pending.timer != null) clearTimer(pending.timer);
    sessions.delete(key);
    const reasons = [...pending.reasons].sort();
    await commit(key, reasons);
    return true;
  }

  function schedule(sessionId, reason = 'semantic_update') {
    const key = String(sessionId || '');
    if (!key) return false;
    let pending = sessions.get(key);
    if (!pending) {
      pending = { reasons: new Set(), timer: null };
      sessions.set(key, pending);
    }
    pending.reasons.add(String(reason || 'semantic_update'));
    if (pending.timer == null) {
      pending.timer = setTimer(() => flush(key), Math.max(0, Number(delayMs) || 0));
    }
    return true;
  }

  function cancel(sessionId) {
    const key = String(sessionId || '');
    const pending = sessions.get(key);
    if (!pending) return false;
    if (pending.timer != null) clearTimer(pending.timer);
    sessions.delete(key);
    return true;
  }

  return {
    schedule,
    flush,
    cancel,
    pending(sessionId) { return sessions.has(String(sessionId || '')); },
    snapshot() {
      return [...sessions.entries()].map(([sessionId, value]) => ({
        sessionId,
        reasons: [...value.reasons].sort()
      }));
    }
  };
}
