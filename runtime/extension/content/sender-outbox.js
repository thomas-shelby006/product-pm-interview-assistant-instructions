function cloneEnvelope(envelope) {
  return { ...envelope, metadata: envelope?.metadata && typeof envelope.metadata === 'object' ? { ...envelope.metadata } : {} };
}

function normalizeEntry(item) {
  const envelope = item?.envelope || item;
  if (!envelope?.id || !envelope?.sessionId) return null;
  return {
    envelope: cloneEnvelope(envelope),
    attempts: Math.max(0, Number(item?.attempts || 0)),
    lastAttemptAt: Math.max(0, Number(item?.lastAttemptAt || 0)),
    nextRetryAt: Math.max(0, Number(item?.nextRetryAt || 0)),
    lastError: String(item?.lastError || '')
  };
}

function cloneEntries(entries) {
  return entries.map(item => ({ ...item, envelope: cloneEnvelope(item.envelope) }));
}

export function nextRetryDelay(attempt = 0, random = Math.random) {
  const base = Math.min(8000, 250 * (2 ** Math.min(5, Math.max(0, Number(attempt) || 0))));
  const jitter = .8 + Math.max(0, Math.min(1, Number(random?.() ?? .5))) * .4;
  return Math.round(base * jitter);
}

export function createSenderOutbox({
  storage = null,
  key = 'pmia_sender_outbox_v1',
  initialEntries = null,
  saveState = null,
  restoredCount = 0,
  recoverySource = 'page_session',
  now = () => Date.now(),
  random = Math.random,
  setTimer = (fn, delay) => setTimeout(fn, delay),
  clearTimer = timer => clearTimeout(timer),
  onState = () => {}
} = {}) {
  if (!Array.isArray(initialEntries) && (!storage?.getItem || !storage?.setItem) && typeof saveState !== 'function') {
    throw new TypeError('Sender outbox requires initialEntries/saveState or sessionStorage-compatible storage');
  }
  const storageKey = String(key || 'pmia_sender_outbox_v1');
  let entries = [];
  let timer = null;
  let replaying = false;
  let scheduledSend = null;
  let persistenceError = '';
  if (Array.isArray(initialEntries)) {
    entries = initialEntries.map(normalizeEntry).filter(Boolean);
  } else {
    try {
      const parsed = JSON.parse(storage.getItem(storageKey) || '[]');
      entries = (Array.isArray(parsed) ? parsed : []).map(normalizeEntry).filter(Boolean);
    } catch { entries = []; }
  }
  const sort = () => entries.sort((a, b) => Number(a.envelope.seq || 0) - Number(b.envelope.seq || 0) || Number(a.envelope.createdAt || 0) - Number(b.envelope.createdAt || 0));
  sort();
  const persist = async () => {
    try {
      if (typeof saveState === 'function') await saveState(cloneEntries(entries));
      else storage.setItem(storageKey, JSON.stringify(entries));
      persistenceError = '';
      return true;
    } catch (error) {
      persistenceError = String(error?.message || error || 'persistence_failed');
      return false;
    }
  };
  const retryIntent = () => {
    const first = entries[0];
    if (!first || !first.nextRetryAt) return null;
    return {
      envelopeId: String(first.envelope.id),
      dueAt: Number(first.nextRetryAt),
      attempt: Math.max(0, Number(first.attempts) || 0),
      reason: String(first.lastError || 'persistence_unconfirmed'),
      source: 'extension_session_outbox'
    };
  };
  const snapshot = () => ({
    count: entries.length,
    replaying,
    attempts: entries[0]?.attempts || 0,
    nextRetryAt: entries[0]?.nextRetryAt || 0,
    oldestCreatedAt: entries[0]?.envelope?.createdAt || 0,
    lastError: entries[0]?.lastError || '',
    persistenceError,
    restoredCount: Math.max(0, Number(restoredCount) || 0),
    recoverySource: String(recoverySource || 'unknown'),
    retryIntent: retryIntent()
  });
  const notify = () => { try { onState(snapshot()); } catch {} };
  function cancelTimer() { if (timer === null) return false; clearTimer(timer); timer = null; return true; }

  const api = {
    async enqueue(envelope) {
      if (!envelope?.id || !envelope?.sessionId) return false;
      if (entries.some(item => item.envelope.id === envelope.id)) return true;
      const before = cloneEntries(entries);
      entries.push(normalizeEntry({ envelope }));
      sort();
      if (!await persist()) { entries = before; notify(); return false; }
      notify();
      return true;
    },
    async ackPersisted(envelopeId) {
      const before = cloneEntries(entries);
      entries = entries.filter(item => item.envelope.id !== String(envelopeId));
      if (entries.length === before.length) return false;
      if (!await persist()) { entries = before; notify(); return false; }
      if (!entries.length) cancelTimer();
      notify();
      return true;
    },
    list() { return entries.map(item => cloneEnvelope(item.envelope)); },
    snapshot,
    get size() { return entries.length; },
    get replaying() { return replaying; },
    async replay(send) {
      if (typeof send !== 'function') throw new TypeError('Sender outbox replay requires send');
      if (replaying) return [];
      cancelTimer(); replaying = true; notify();
      const results = [];
      try {
        for (const entry of [...entries]) {
          const current = entries.find(item => item.envelope.id === entry.envelope.id);
          if (!current) continue;
          current.attempts += 1;
          current.lastAttemptAt = Number(now());
          current.nextRetryAt = 0;
          if (!await persist()) {
            current.lastError = 'outbox_attempt_persist_failed';
            current.nextRetryAt = Number(now()) + nextRetryDelay(current.attempts - 1, random);
            await persist();
            results.push({ envelopeId: current.envelope.id, response: { ok:false, persisted:false, error:'outbox_attempt_persist_failed' } });
            break;
          }
          let response;
          try { response = await send(cloneEnvelope(current.envelope)); }
          catch (error) { response = { ok: false, persisted: false, error: String(error?.message || error) }; }
          results.push({ envelopeId: current.envelope.id, response });
          if (response?.persisted) {
            if (entries.some(item => item.envelope.id === current.envelope.id)) {
              await api.ackPersisted(current.envelope.id);
            }
            continue;
          }
          current.lastError = String(response?.error || response?.reason || 'persistence_unconfirmed');
          current.nextRetryAt = Number(now()) + nextRetryDelay(current.attempts - 1, random);
          await persist();
          break;
        }
      } finally { replaying = false; notify(); }
      return results;
    },
    schedule(send, { immediate = false } = {}) {
      if (typeof send !== 'function' || !entries.length) return false;
      scheduledSend = send; cancelTimer();
      const delay = immediate ? 0 : Math.max(0, Number(entries[0].nextRetryAt || now()) - Number(now()));
      timer = setTimer(async () => { timer = null; await api.replay(scheduledSend); if (entries.length) api.schedule(scheduledSend); }, delay);
      notify(); return true;
    },
    async retryNow(send = scheduledSend) { if (typeof send !== 'function') return []; cancelTimer(); const results = await api.replay(send); if (entries.length) api.schedule(send); return results; },
    cancel() { const cancelled = cancelTimer(); notify(); return cancelled; },
    async clear() { cancelTimer(); const before = cloneEntries(entries); entries = []; if (!await persist()) { entries = before; notify(); return 0; } notify(); return before.length; }
  };
  return api;
}
