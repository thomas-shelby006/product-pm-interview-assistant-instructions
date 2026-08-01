function cloneEnvelope(envelope) {
  return {
    ...envelope,
    metadata: envelope?.metadata && typeof envelope.metadata === 'object'
      ? { ...envelope.metadata }
      : {}
  };
}

export function createSenderOutbox({ storage, key } = {}) {
  if (!storage?.getItem || !storage?.setItem) {
    throw new TypeError('Sender outbox requires sessionStorage-compatible storage');
  }
  const storageKey = String(key || 'pmia_sender_outbox_v1');
  let entries = [];
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) || '[]');
    entries = Array.isArray(parsed)
      ? parsed.filter(item => item?.id && item?.sessionId).map(cloneEnvelope)
      : [];
  } catch {
    entries = [];
  }

  const persist = () => {
    storage.setItem(storageKey, JSON.stringify(entries));
  };

  return {
    enqueue(envelope) {
      if (!envelope?.id || !envelope?.sessionId) return false;
      if (entries.some(item => item.id === envelope.id)) return true;
      entries.push(cloneEnvelope(envelope));
      entries.sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0));
      persist();
      return true;
    },

    ackPersisted(envelopeId) {
      const before = entries.length;
      entries = entries.filter(item => item.id !== String(envelopeId));
      if (entries.length !== before) persist();
      return entries.length !== before;
    },

    list() {
      return entries.map(cloneEnvelope);
    },

    get size() {
      return entries.length;
    },

    async replay(send) {
      if (typeof send !== 'function') throw new TypeError('Sender outbox replay requires send');
      const results = [];
      for (const envelope of [...entries]) {
        let response;
        try {
          response = await send(cloneEnvelope(envelope));
        } catch (error) {
          response = { ok: false, error: String(error?.message || error) };
        }
        if (response?.persisted) this.ackPersisted(envelope.id);
        results.push({ envelopeId: envelope.id, response });
        if (!response?.persisted) break;
      }
      return results;
    },

    clear() {
      const count = entries.length;
      entries = [];
      persist();
      return count;
    }
  };
}
