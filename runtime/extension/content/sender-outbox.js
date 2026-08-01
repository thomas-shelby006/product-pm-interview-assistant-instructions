function cloneEnvelope(envelope) {
  return {
    ...envelope,
    metadata: envelope?.metadata && typeof envelope.metadata === 'object'
      ? { ...envelope.metadata }
      : {}
  };
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

export function nextRetryDelay(attempt = 0, random = Math.random) {
  const base = Math.min(8000, 250 * (2 ** Math.min(5, Math.max(0, Number(attempt) || 0))));
  const jitter = .8 + Math.max(0, Math.min(1, Number(random?.() ?? .5))) * .4;
  return Math.round(base * jitter);
}

export function createSenderOutbox({
  storage,
  key,
  now = () => Date.now(),
  random = Math.random,
  setTimer = (fn, delay) => setTimeout(fn, delay),
  clearTimer = timer => clearTimeout(timer),
  onState = () => {}
} = {}) {
  if (!storage?.getItem || !storage?.setItem) {
    throw new TypeError('Sender outbox requires sessionStorage-compatible storage');
  }
  const storageKey = String(key || 'pmia_sender_outbox_v1');
  let entries = [];
  let timer = null;
  let replaying = false;
  let scheduledSend = null;
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) || '[]');
    entries = (Array.isArray(parsed) ? parsed : []).map(normalizeEntry).filter(Boolean);
  } catch {
    entries = [];
  }

  const sort = () => entries.sort((a, b) => (
    Number(a.envelope.seq || 0) - Number(b.envelope.seq || 0)
    || Number(a.envelope.createdAt || 0) - Number(b.envelope.createdAt || 0)
  ));
  sort();

  const persist = () => storage.setItem(storageKey, JSON.stringify(entries));
  const snapshot = () => ({
    count: entries.length,
    replaying,
    attempts: entries[0]?.attempts || 0,
    nextRetryAt: entries[0]?.nextRetryAt || 0,
    oldestCreatedAt: entries[0]?.envelope?.createdAt || 0,
    lastError: entries[0]?.lastError || ''
  });
  const notify = () => onState(snapshot());

  function cancelTimer() {
    if (timer === null) return false;
    clearTimer(timer);
    timer = null;
    return true;
  }

  const api = {
    enqueue(envelope) {
      if (!envelope?.id || !envelope?.sessionId) return false;
      if (entries.some(item => item.envelope.id === envelope.id)) return true;
      entries.push(normalizeEntry({ envelope }));
      sort();
      persist();
      notify();
      return true;
    },

    ackPersisted(envelopeId) {
      const before = entries.length;
      entries = entries.filter(item => item.envelope.id !== String(envelopeId));
      if (entries.length !== before) {
        persist();
        if (!entries.length) cancelTimer();
        notify();
      }
      return entries.length !== before;
    },

    list() { return entries.map(item => cloneEnvelope(item.envelope)); },
    snapshot,
    get size() { return entries.length; },
    get replaying() { return replaying; },

    async replay(send) {
      if (typeof send !== 'function') throw new TypeError('Sender outbox replay requires send');
      if (replaying) return [];
      cancelTimer();
      replaying = true;
      notify();
      const results = [];
      try {
        for (const entry of [...entries]) {
          const current = entries.find(item => item.envelope.id === entry.envelope.id);
          if (!current) continue;
          current.attempts += 1;
          current.lastAttemptAt = Number(now());
          current.nextRetryAt = 0;
          let response;
          try {
            response = await send(cloneEnvelope(current.envelope));
          } catch (error) {
            response = { ok: false, persisted: false, error: String(error?.message || error) };
          }
          results.push({ envelopeId: current.envelope.id, response });
          if (response?.persisted) {
            api.ackPersisted(current.envelope.id);
            continue;
          }
          current.lastError = String(response?.error || response?.reason || 'persistence_unconfirmed');
          current.nextRetryAt = Number(now()) + nextRetryDelay(current.attempts - 1, random);
          persist();
          break;
        }
      } finally {
        replaying = false;
        notify();
      }
      return results;
    },

    schedule(send, { immediate = false } = {}) {
      if (typeof send !== 'function' || !entries.length) return false;
      scheduledSend = send;
      cancelTimer();
      const delay = immediate ? 0 : Math.max(0, Number(entries[0].nextRetryAt || now()) - Number(now()));
      timer = setTimer(async () => {
        timer = null;
        await api.replay(scheduledSend);
        if (entries.length) api.schedule(scheduledSend);
      }, delay);
      notify();
      return true;
    },

    async retryNow(send = scheduledSend) {
      if (typeof send !== 'function') return [];
      cancelTimer();
      const results = await api.replay(send);
      if (entries.length) api.schedule(send);
      return results;
    },

    cancel() {
      const cancelled = cancelTimer();
      notify();
      return cancelled;
    },

    clear() {
      cancelTimer();
      const count = entries.length;
      entries = [];
      persist();
      notify();
      return count;
    }
  };

  return api;
}
