function cloneEntry(entry) {
  return {
    id: String(entry?.id || entry?.envelope?.id || ''),
    envelope: entry?.envelope ? { ...entry.envelope, metadata: { ...(entry.envelope.metadata || {}) } } : null,
    addedAt: Number(entry?.addedAt || Date.now())
  };
}

function batchId(entries) {
  const first = entries[0]?.envelope;
  const last = entries.at(-1)?.envelope;
  return `batch-${Number(first?.seq || 0)}-${Number(last?.seq || 0)}-${String(last?.id || '').slice(-8)}`;
}

export function composeBatchPrompt({ entries = [] } = {}) {
  const questions = entries
    .map(entry => String(entry?.envelope?.text || '').trim())
    .filter(Boolean);
  if (!questions.length) return { text: '', memberIds: [], focusId: '', questionCount: 0, fingerprint: '' };
  const text = questions.length === 1
    ? questions[0]
    : questions.map((question, index) => `Question ${index + 1}:\n${question}`).join('\n\n');
  const memberIds = entries.map(entry => String(entry.id));
  return {
    text,
    memberIds,
    focusId: memberIds.at(-1) || '',
    questionCount: questions.length,
    fingerprint: `${memberIds.join('|')}::${text}`
  };
}

export class BatchPlanner {
  #active = null;
  #next = [];
  #hold = false;
  #autoSubmit = true;
  #known = new Set();

  constructor(state = {}) {
    this.#hold = Boolean(state?.hold);
    this.#autoSubmit = state?.autoSubmit !== false;
    this.#active = state?.active ? this.#normalizeBatch(state.active) : null;
    this.#next = Array.isArray(state?.next) ? state.next.map(cloneEntry).filter(entry => entry.id) : [];
    for (const entry of [...(this.#active?.entries || []), ...this.#next]) this.#known.add(entry.id);
  }

  add(envelope, now = Date.now()) {
    const id = String(envelope?.id || '');
    if (!id) return { accepted: false, duplicate: false, reason: 'invalid_entry' };
    if (this.#known.has(id)) return { accepted: true, duplicate: true, reason: 'duplicate' };
    const entry = cloneEntry({ id, envelope, addedAt: now });
    this.#next.push(entry);
    this.#next.sort((a, b) => Number(a.envelope?.seq || 0) - Number(b.envelope?.seq || 0));
    this.#known.add(id);
    return { accepted: true, duplicate: false, reason: 'accumulated', entry };
  }

  freezeNext(now = Date.now()) {
    if (this.#active || !this.#next.length) return null;
    const entries = this.#next.map(cloneEntry);
    this.#next = [];
    const prompt = composeBatchPrompt({ entries });
    this.#active = {
      id: batchId(entries),
      entries,
      prompt,
      createdAt: now,
      submittedAt: 0
    };
    return this.active();
  }

  markSubmitted(now = Date.now()) {
    if (!this.#active) return null;
    this.#active.submittedAt = now;
    return this.active();
  }

  completeActive() {
    const completed = this.active();
    this.#active = null;
    return completed;
  }

  failActive() {
    if (!this.#active) return null;
    const failed = this.active();
    this.#next = [...failed.entries.map(cloneEntry), ...this.#next]
      .sort((a, b) => Number(a.envelope?.seq || 0) - Number(b.envelope?.seq || 0));
    this.#active = null;
    return failed;
  }

  setHold(value) {
    this.#hold = Boolean(value);
    return this.#hold;
  }

  setAutoSubmit(value) {
    this.#autoSubmit = Boolean(value);
    return this.#autoSubmit;
  }

  get hold() { return this.#hold; }
  get autoSubmit() { return this.#autoSubmit; }
  get nextSize() { return this.#next.length; }

  active() {
    return this.#active ? this.#normalizeBatch(this.#active) : null;
  }

  next() {
    const entries = this.#next.map(cloneEntry);
    return {
      entries,
      prompt: composeBatchPrompt({ entries }),
      count: entries.length
    };
  }

  snapshot() {
    return {
      active: this.active(),
      next: this.next(),
      hold: this.#hold,
      autoSubmit: this.#autoSubmit
    };
  }

  exportState() {
    return this.snapshot();
  }

  #normalizeBatch(batch) {
    const entries = Array.isArray(batch?.entries) ? batch.entries.map(cloneEntry).filter(entry => entry.id) : [];
    return {
      id: String(batch?.id || batchId(entries)),
      entries,
      prompt: batch?.prompt || composeBatchPrompt({ entries }),
      createdAt: Number(batch?.createdAt || Date.now()),
      submittedAt: Number(batch?.submittedAt || 0)
    };
  }
}
