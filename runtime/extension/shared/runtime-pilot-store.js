import { RuntimePilotState } from './runtime-pilot-state.js';
import { estimateStorageCategories } from './storage-accounting.js';
import { createStateCommitJournal, recoverCommittedState } from './state-commit-journal.js';
import { validateRuntimeState } from './runtime-invariants.js';

function stateHash(value) {
  let hash = 0x811c9dc5;
  for (const character of JSON.stringify(value ?? null)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function createRuntimePilotStore({
  storageArea,
  key = 'pmia_runtime_pilot_v1'
} = {}) {
  if (!storageArea?.get || !storageArea?.set || !storageArea?.remove) {
    throw new TypeError('PMIA runtime pilot requires chrome.storage.session');
  }
  const journalKey = `${key}_commit_journal`;
  const previousKey = `${key}_previous_applied`;
  let statePromise = null;
  let commitJournal = createStateCommitJournal();
  let lastAudit = { recovered: false, repaired: 0, blocked: 0, findings: [] };

  async function hydrate() {
    const stored = await storageArea.get([key, journalKey, previousKey]);
    commitJournal = createStateCommitJournal(stored[journalKey] || {});
    const recovered = recoverCommittedState({
      currentState: stored[key] || [],
      previousState: stored[previousKey] || [],
      journal: stored[journalKey] || {}
    });
    if (recovered.recovered) {
      commitJournal = createStateCommitJournal(recovered.journal);
      await storageArea.set({
        [key]: recovered.state,
        [journalKey]: commitJournal.snapshot()
      });
    }
    const invariant = validateRuntimeState(recovered.state);
    lastAudit = {
      recovered: recovered.recovered,
      recoveryReason: recovered.reason,
      repaired: invariant.repaired,
      blocked: invariant.blocked,
      findings: invariant.findings
    };
    if (invariant.repaired > 0) await storageArea.set({ [key]: invariant.state });
    return new RuntimePilotState(invariant.state);
  }

  return {
    async load() {
      if (!statePromise) {
        statePromise = hydrate().catch(error => {
          statePromise = null;
          throw error;
        });
      }
      return statePromise;
    },

    async save(state) {
      if (!(state instanceof RuntimePilotState)) {
        throw new TypeError('Invalid PMIA runtime pilot state');
      }
      const nextState = state.exportState();
      const current = await storageArea.get(key);
      const prepared = commitJournal.prepare({ stateHash: stateHash(nextState) });
      await storageArea.set({
        [previousKey]: Array.isArray(current[key]) ? current[key] : [],
        [journalKey]: prepared
      });
      await storageArea.set({ [key]: nextState });
      const applied = commitJournal.apply(prepared.generation);
      await storageArea.set({ [journalKey]: applied });
    },

    estimate(state) {
      if (!(state instanceof RuntimePilotState)) throw new TypeError('Invalid PMIA runtime pilot state');
      return estimateStorageCategories(state.exportState());
    },

    async bytesInUse() {
      if (typeof storageArea.getBytesInUse !== 'function') return 0;
      return Number(await storageArea.getBytesInUse(null)) || 0;
    },

    audit() {
      return {
        ...lastAudit,
        findings: (lastAudit.findings || []).map(item => ({ ...item })),
        commit: commitJournal.snapshot()
      };
    },

    async clear() {
      statePromise = Promise.resolve(new RuntimePilotState());
      commitJournal = createStateCommitJournal();
      lastAudit = { recovered: false, repaired: 0, blocked: 0, findings: [] };
      await storageArea.remove([key, journalKey, previousKey]);
    },

    resetCache() {
      statePromise = null;
    }
  };
}