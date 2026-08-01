function sequenceKey(provider, seq) {
  const value = Number(seq || 0);
  return value > 0 && provider ? `${String(provider)}:${value}` : '';
}

export class DeliveryLedgerIndex {
  #byId = new Map();
  #bySequence = new Map();
  #rebuilds = 0;

  constructor(entries = []) {
    this.rebuild(entries);
  }

  byId(id) {
    return this.#byId.get(String(id || '')) || null;
  }

  bySequence(provider, seq) {
    const key = sequenceKey(provider, seq);
    return key ? this.#bySequence.get(key) || null : null;
  }

  insert(entry) {
    const id = String(entry?.id || '');
    if (!id) return { accepted: false, reason: 'invalid_id', entry: null };
    const existingId = this.#byId.get(id);
    if (existingId) return { accepted: false, reason: 'duplicate_id', entry: existingId };
    const key = sequenceKey(entry?.envelope?.sourceProvider, entry?.envelope?.seq);
    const existingSequence = key ? this.#bySequence.get(key) : null;
    if (existingSequence) return { accepted: false, reason: 'duplicate_sequence', entry: existingSequence };
    this.#byId.set(id, entry);
    if (key) this.#bySequence.set(key, entry);
    return { accepted: true, reason: 'inserted', entry };
  }

  remove(entry) {
    const current = this.byId(entry?.id);
    if (!current || current !== entry) return false;
    this.#byId.delete(String(entry.id));
    const key = sequenceKey(entry?.envelope?.sourceProvider, entry?.envelope?.seq);
    if (key && this.#bySequence.get(key) === entry) this.#bySequence.delete(key);
    return true;
  }

  rebuild(entries = []) {
    this.#byId.clear();
    this.#bySequence.clear();
    this.#rebuilds += 1;
    for (const entry of Array.isArray(entries) ? entries : []) this.insert(entry);
    return this.stats();
  }

  stats() {
    return {
      ids: this.#byId.size,
      sequences: this.#bySequence.size,
      rebuilds: this.#rebuilds
    };
  }
}
