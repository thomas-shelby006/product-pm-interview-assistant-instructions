import { partitionEntries } from './batch-partitioner.js';

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

function normalizedText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function stableFingerprint(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value || '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}


export function canonicalMemberIds(memberIds = []) {
  return [...new Set((Array.isArray(memberIds) ? memberIds : []).map(String).filter(Boolean))].sort();
}

export function memberSetFingerprint(memberIds = []) {
  return stableFingerprint(canonicalMemberIds(memberIds).join('|'));
}

export function sameMemberSet(first = [], second = []) {
  const left = canonicalMemberIds(first);
  const right = canonicalMemberIds(second);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function composeBatchPrompt({ entries = [] } = {}) {
  const valid = entries
    .map(cloneEntry)
    .filter(entry => entry.id && normalizedText(entry.envelope?.text));
  const memberIds = valid.map(entry => entry.id);
  if (!valid.length) return { text: '', memberIds: [], focusId: '', questionCount: 0, fingerprint: '', memberFingerprint: '' };
  const latest = valid.at(-1);
  const text = valid.length === 1
    ? String(latest.envelope.text).trim()
    : [
        'MULTIPLE INTERVIEWER QUESTIONS WERE RECEIVED WHILE THE PREVIOUS ANSWER WAS IN PROGRESS.',
        'Answer all questions, but focus primarily on the latest question. Keep responses to earlier questions brief unless they are needed for context.',
        '',
        ...valid.slice(0, -1).flatMap((entry, index) => [
          `EARLIER QUESTION ${index + 1}:`,
          String(entry.envelope.text).trim(),
          ''
        ]),
        'LATEST QUESTION (HIGHEST PRIORITY):',
        String(latest.envelope.text).trim()
      ].join('\n');
  return {
    text,
    memberIds,
    focusId: latest.id,
    questionCount: valid.length,
    fingerprint: stableFingerprint(`${memberIds.join('|')}::${text}`),
    memberFingerprint: memberSetFingerprint(memberIds)
  };
}

export function matchesRenderedBatch(renderedText, prompt) {
  const rendered = normalizedText(renderedText);
  if (!rendered || !prompt?.questionCount) return false;
  const expected = normalizedText(prompt.text);
  if (rendered === expected || rendered.includes(expected) || expected.includes(rendered)) return true;
  return (prompt.memberIds || []).length === 1 && rendered.includes(expected);
}

export class BatchPlanner {
  #active = null;
  #next = [];
  #hold = false;
  #autoSubmit = true;
  #known = new Set();
  #maxBatchMembers;
  #maxBatchChars;

  constructor(state = {}, { maxBatchMembers = 8, maxBatchChars = 12000 } = {}) {
    this.#hold = Boolean(state?.hold);
    this.#maxBatchMembers = Math.max(1, Number(maxBatchMembers) || 8);
    this.#maxBatchChars = Math.max(256, Number(maxBatchChars) || 12000);
    this.#autoSubmit = state?.autoSubmit !== false;
    this.#active = state?.active ? this.#normalizeBatch(state.active) : null;
    const nextEntries = Array.isArray(state?.next)
      ? state.next
      : Array.isArray(state?.next?.entries)
        ? state.next.entries
        : [];
    this.#next = nextEntries.map(cloneEntry).filter(entry => entry.id);
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
    const entries = this.#partitionNext()[0] || [];
    if (!entries.length) return null;
    const selected = new Set(entries.map(entry => entry.id));
    this.#next = this.#next.filter(entry => !selected.has(entry.id));
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

  interruptLatest(now = Date.now()) {
    if (!this.#next.length) return null;
    const latest = cloneEntry(this.#next.pop());
    const interrupted = this.active();
    this.#active = null;
    const entries = [latest];
    const prompt = composeBatchPrompt({ entries });
    this.#active = {
      id: `interrupt-${Number(latest.envelope?.seq || 0)}-${String(latest.id).slice(-8)}`,
      entries,
      prompt,
      createdAt: now,
      submittedAt: 0
    };
    return { batch: this.active(), interrupted };
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

  requeueEntries(entries = []) {
    const activeIds = new Set((this.#active?.entries || []).map(entry => String(entry.id)));
    const nextIds = new Set(this.#next.map(entry => String(entry.id)));
    const restored = [];
    for (const source of Array.isArray(entries) ? entries : []) {
      const entry = cloneEntry(source);
      if (!entry.id || activeIds.has(entry.id) || nextIds.has(entry.id)) continue;
      this.#next.push(entry);
      nextIds.add(entry.id);
      this.#known.add(entry.id);
      restored.push(entry.id);
    }
    this.#next.sort((a, b) => Number(a.envelope?.seq || 0) - Number(b.envelope?.seq || 0));
    return { restored, nextSize: this.#next.length };
  }

  setHold(value) {
    this.#hold = Boolean(value);
    return this.#hold;
  }

  setAutoSubmit(value) {
    this.#autoSubmit = Boolean(value);
    return this.#autoSubmit;
  }

  setBudget({ maxMembers = this.#maxBatchMembers, maxChars = this.#maxBatchChars } = {}) {
    this.#maxBatchMembers = Math.max(1, Number(maxMembers) || this.#maxBatchMembers);
    this.#maxBatchChars = Math.max(256, Number(maxChars) || this.#maxBatchChars);
    return this.budget();
  }

  budget() {
    return { maxMembers: this.#maxBatchMembers, maxChars: this.#maxBatchChars };
  }
  get hold() { return this.#hold; }
  get autoSubmit() { return this.#autoSubmit; }
  get nextSize() { return this.#next.length; }

  active() {
    return this.#active ? this.#normalizeBatch(this.#active) : null;
  }

  next() {
    const entries = this.#next.map(cloneEntry);
    const partitions = this.#partitionNext();
    const first = partitions[0] || [];
    return {
      entries,
      prompt: composeBatchPrompt({ entries: first }),
      count: entries.length,
      partitionCount: partitions.length,
      firstPartitionCount: first.length,
      remainingCount: Math.max(0, entries.length - first.length),
      partitions: partitions.map((group, index) => ({
        index,
        memberIds: group.map(entry => entry.id),
        count: group.length
      }))
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

  #partitionNext() {
    return partitionEntries(this.#next, {
      maxMembers: this.#maxBatchMembers,
      maxChars: this.#maxBatchChars,
      measure: entries => composeBatchPrompt({ entries }).text.length
    });
  }

  #normalizeBatch(batch) {
    const entries = Array.isArray(batch?.entries) ? batch.entries.map(cloneEntry).filter(entry => entry.id) : [];
    return {
      id: String(batch?.id || batchId(entries)),
      entries,
      prompt: batch?.prompt?.memberFingerprint
        ? { ...batch.prompt }
        : { ...composeBatchPrompt({ entries }), ...(batch?.prompt || {}) },
      createdAt: Number(batch?.createdAt || Date.now()),
      submittedAt: Number(batch?.submittedAt || 0)
    };
  }
}
