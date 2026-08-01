function clone(value) {
  if (value === undefined) return null;
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

export function normalizeCommitJournal(value = {}) {
  const generation = Math.max(0, Number(value?.generation) || 0);
  const appliedGeneration = Math.max(0, Math.min(generation, Number(value?.appliedGeneration) || 0));
  return {
    phase: value?.phase === 'prepared' ? 'prepared' : 'applied',
    generation,
    appliedGeneration,
    stateHash: String(value?.stateHash || ''),
    preparedAt: Math.max(0, Number(value?.preparedAt) || 0),
    appliedAt: Math.max(0, Number(value?.appliedAt) || 0),
    recoveryCount: Math.max(0, Number(value?.recoveryCount) || 0)
  };
}

export function createStateCommitJournal(initial = {}) {
  let value = normalizeCommitJournal(initial);
  return {
    prepare({ stateHash = '', now = Date.now() } = {}) {
      value = {
        ...value,
        phase: 'prepared',
        generation: value.generation + 1,
        stateHash: String(stateHash || ''),
        preparedAt: Number(now) || Date.now(),
        appliedAt: 0
      };
      return { ...value };
    },
    apply(generation, now = Date.now()) {
      if (Number(generation) !== value.generation) return { ...value, error: 'commit_generation_mismatch' };
      value = {
        ...value,
        phase: 'applied',
        appliedGeneration: value.generation,
        appliedAt: Number(now) || Date.now()
      };
      return { ...value };
    },
    recover() {
      value = {
        ...value,
        phase: 'applied',
        generation: value.appliedGeneration,
        recoveryCount: value.recoveryCount + 1,
        stateHash: '',
        preparedAt: 0
      };
      return { ...value };
    },
    snapshot() { return { ...value }; }
  };
}

export function recoverCommittedState({ currentState = [], previousState = [], journal = {} } = {}) {
  const normalized = normalizeCommitJournal(journal);
  if (normalized.phase === 'prepared' && normalized.generation > normalized.appliedGeneration) {
    return {
      recovered: true,
      reason: 'unapplied_generation',
      state: clone(previousState),
      journal: createStateCommitJournal(normalized).recover()
    };
  }
  return {
    recovered: false,
    reason: 'current_generation_applied',
    state: clone(currentState),
    journal: normalized
  };
}